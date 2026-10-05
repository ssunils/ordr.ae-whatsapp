import { Inject, Injectable, Logger } from "@nestjs/common";
import { type ActionRegistry, type Blueprint, detectLanguage, FlowRunner, type RunResult } from "@ordr/flow-schema";
import { type InboundEvent, type InboundMessage, type InboundStatus, type MessageSender, text } from "@ordr/whatsapp";
import type { AppConfig } from "../config";
import type { BlueprintRegistry, ConversationRepository, DedupeStore, SessionStore, TenantContext, TenantRepository } from "../ports";
import { TOKENS } from "../tokens";

const APOLOGY: Record<string, string> = {
  en: "Sorry, something went wrong on our side. Please send \"menu\" to try again.",
  ar: "عذراً، حدث خطأ من جانبنا. يرجى إرسال \"القائمة\" للمحاولة مرة أخرى.",
};

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);
  private readonly runners = new Map<string, FlowRunner>();

  constructor(
    @Inject(TOKENS.Config) private readonly config: AppConfig,
    @Inject(TOKENS.TenantRepository) private readonly tenants: TenantRepository,
    @Inject(TOKENS.ConversationRepository) private readonly conversations: ConversationRepository,
    @Inject(TOKENS.SessionStore) private readonly sessions: SessionStore,
    @Inject(TOKENS.DedupeStore) private readonly dedupe: DedupeStore,
    @Inject(TOKENS.MessageSender) private readonly sender: MessageSender,
    @Inject(TOKENS.ActionRegistry) private readonly actions: ActionRegistry,
    @Inject(TOKENS.BlueprintRegistry) private readonly blueprints: BlueprintRegistry,
  ) {}

  async handleEvent(event: InboundEvent): Promise<void> {
    if (event.type === "status") return this.handleStatus(event);
    return this.handleMessage(event);
  }

  private async handleStatus(event: InboundStatus): Promise<void> {
    await this.conversations.updateMessageStatus(event.messageId, event.status);
  }

  private async handleMessage(event: InboundMessage): Promise<void> {
    const ctx = await this.tenants.findByPhoneNumberId(event.phoneNumberId);
    if (!ctx) {
      this.logger.warn(`no tenant for phone_number_id ${event.phoneNumberId}; ignoring message ${event.messageId}`);
      return;
    }
    if (!(await this.dedupe.claim(`wamid:${event.messageId}`, this.config.DEDUPE_TTL_SECONDS))) {
      this.logger.debug(`duplicate webhook for ${event.messageId}`);
      return;
    }

    const { tenant, channel } = ctx;
    const blueprint = this.blueprints.get(tenant.blueprintId);
    if (!blueprint) {
      this.logger.error(`tenant ${tenant.id} references unknown blueprint "${tenant.blueprintId}"`);
      return;
    }

    const customer = await this.conversations.upsertCustomer(tenant.id, event.from, event.profileName);
    const conversation = await this.conversations.getOrCreateOpenConversation(tenant.id, customer.id, channel.id);
    const receivedAt = new Date(event.timestamp * 1000);
    await this.conversations.recordMessage({
      tenantId: tenant.id,
      conversationId: conversation.id,
      direction: "in",
      providerMessageId: event.messageId,
      kind: event.content.kind,
      payload: event.content,
      createdAt: receivedAt,
    });
    await this.conversations.touchInbound(conversation.id, receivedAt);
    this.markRead(ctx, event.messageId);

    const runner = this.runnerFor(blueprint);
    const session = await this.sessions.get(tenant.id, event.from);
    const globalFlow = runner.matchGlobalCommand(event.content);

    if (!globalFlow && conversation.status === "human") {
      // An agent owns this thread. The bot stays quiet until the customer asks for the menu.
      return;
    }

    const language =
      session?.language ??
      customer.language ??
      (event.content.kind === "text"
        ? detectLanguage(event.content.text, blueprint.languages, tenant.defaultLanguage)
        : tenant.defaultLanguage);
    const baseContext = {
      tenant: { id: tenant.id, name: tenant.name },
      customer: { id: customer.id, waId: customer.waId, name: customer.name ?? "" },
    };
    const actionCtx = { tenantId: tenant.id, customer: { waId: customer.waId, name: customer.name } };

    let result: RunResult;
    try {
      if (globalFlow) {
        if (conversation.status === "human") await this.conversations.setConversationStatus(conversation.id, "bot");
        result = await runner.start(globalFlow, { language, context: baseContext }, actionCtx);
      } else if (session?.awaiting) {
        result = await runner.resume(session, event.content, actionCtx);
      } else {
        const entry = blueprint.fallbackFlow ?? blueprint.entryFlow;
        result = await runner.start(entry, { language, context: baseContext }, actionCtx);
      }
    } catch (err) {
      this.logger.error(`flow error for tenant ${tenant.id}, customer ${event.from}: ${err instanceof Error ? err.stack : String(err)}`);
      await this.sessions.delete(tenant.id, event.from);
      await this.deliver(ctx, conversation.id, event.from, [text(APOLOGY[language] ?? APOLOGY.en!)]);
      return;
    }

    await this.deliver(ctx, conversation.id, event.from, result.outbound);

    const finalLanguage = result.session?.language ?? language;
    if (finalLanguage !== customer.language) await this.conversations.setCustomerLanguage(customer.id, finalLanguage);

    if (result.handoff) await this.conversations.setConversationStatus(conversation.id, "human");

    if (result.session) await this.sessions.set(tenant.id, event.from, result.session, this.config.SESSION_TTL_SECONDS);
    else await this.sessions.delete(tenant.id, event.from);
  }

  private async deliver(ctx: TenantContext, conversationId: string, to: string, messages: RunResult["outbound"]): Promise<void> {
    const target = { phoneNumberId: ctx.channel.phoneNumberId, accessToken: ctx.channel.accessToken, to };
    for (const message of messages) {
      try {
        const { providerMessageId } = await this.sender.send(target, message);
        await this.conversations.recordMessage({
          tenantId: ctx.tenant.id,
          conversationId,
          direction: "out",
          providerMessageId,
          kind: message.type === "interactive" ? `interactive.${message.interactive.type}` : message.type,
          payload: message,
          createdAt: new Date(),
        });
      } catch (err) {
        this.logger.error(`send to ${to} failed: ${err instanceof Error ? err.message : String(err)}`);
        return;
      }
    }
  }

  private markRead(ctx: TenantContext, messageId: string): void {
    if (!this.sender.markRead) return;
    this.sender
      .markRead({ phoneNumberId: ctx.channel.phoneNumberId, accessToken: ctx.channel.accessToken }, messageId)
      .catch((err) => this.logger.debug(`markRead failed: ${err instanceof Error ? err.message : String(err)}`));
  }

  private runnerFor(blueprint: Blueprint): FlowRunner {
    const key = `${blueprint.id}@${blueprint.version}`;
    let runner = this.runners.get(key);
    if (!runner) {
      runner = new FlowRunner(blueprint, this.actions);
      this.runners.set(key, runner);
    }
    return runner;
  }
}
