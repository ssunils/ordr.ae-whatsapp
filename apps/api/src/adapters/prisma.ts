import { Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import type { Customer } from "@ordr/domain";
import type { SessionState } from "@ordr/flow-schema";
import { Prisma, PrismaClient } from "@prisma/client";
import type {
  ConversationRecord,
  ConversationRepository,
  ConversationStatus,
  DedupeStore,
  MessageRecord,
  SessionStore,
  TenantContext,
  TenantRepository,
} from "../ports";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

export class PrismaTenantRepository implements TenantRepository {
  private readonly cache = new Map<string, { ctx: TenantContext | null; until: number }>();

  constructor(
    private readonly prisma: PrismaClient,
    private readonly cacheTtlMs = 60_000,
  ) {}

  async findByPhoneNumberId(phoneNumberId: string): Promise<TenantContext | null> {
    const hit = this.cache.get(phoneNumberId);
    if (hit && hit.until > Date.now()) return hit.ctx;
    const channel = await this.prisma.channel.findUnique({ where: { phoneNumberId }, include: { tenant: true } });
    const ctx: TenantContext | null =
      channel && channel.status === "active"
        ? {
            tenant: {
              id: channel.tenant.id,
              name: channel.tenant.name,
              slug: channel.tenant.slug,
              blueprintId: channel.tenant.blueprintId,
              defaultLanguage: channel.tenant.defaultLanguage,
              timezone: channel.tenant.timezone,
              settings: (channel.tenant.settings as Record<string, unknown>) ?? {},
            },
            channel: {
              id: channel.id,
              tenantId: channel.tenantId,
              provider: "meta_cloud",
              phoneNumberId: channel.phoneNumberId,
              wabaId: channel.wabaId,
              displayPhone: channel.displayPhone,
              accessToken: channel.accessToken,
              status: "active",
            },
          }
        : null;
    this.cache.set(phoneNumberId, { ctx, until: Date.now() + this.cacheTtlMs });
    return ctx;
  }
}

export class PrismaConversationRepository implements ConversationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async upsertCustomer(tenantId: string, waId: string, name?: string): Promise<Customer> {
    const c = await this.prisma.customer.upsert({
      where: { tenantId_waId: { tenantId, waId } },
      update: name ? { name } : {},
      create: { tenantId, waId, name },
    });
    return { id: c.id, tenantId: c.tenantId, waId: c.waId, name: c.name ?? undefined, language: c.language ?? undefined };
  }

  async setCustomerLanguage(customerId: string, language: string): Promise<void> {
    await this.prisma.customer.update({ where: { id: customerId }, data: { language } });
  }

  async getOrCreateOpenConversation(tenantId: string, customerId: string, channelId: string): Promise<ConversationRecord> {
    const existing = await this.prisma.conversation.findFirst({
      where: { tenantId, customerId, status: { not: "closed" } },
      orderBy: { createdAt: "desc" },
    });
    const row = existing ?? (await this.prisma.conversation.create({ data: { tenantId, customerId, channelId } }));
    return { id: row.id, tenantId: row.tenantId, customerId: row.customerId, channelId: row.channelId, status: row.status as ConversationStatus };
  }

  async setConversationStatus(conversationId: string, status: ConversationStatus): Promise<void> {
    await this.prisma.conversation.update({ where: { id: conversationId }, data: { status } });
  }

  async touchInbound(conversationId: string, at: Date): Promise<void> {
    await this.prisma.conversation.update({ where: { id: conversationId }, data: { lastInboundAt: at } });
  }

  async recordMessage(m: MessageRecord): Promise<void> {
    await this.prisma.message.create({
      data: {
        tenantId: m.tenantId,
        conversationId: m.conversationId,
        direction: m.direction,
        providerMessageId: m.providerMessageId,
        kind: m.kind,
        payload: m.payload as Prisma.InputJsonValue,
        createdAt: m.createdAt,
      },
    });
  }

  async updateMessageStatus(providerMessageId: string, status: string): Promise<void> {
    await this.prisma.message.updateMany({ where: { providerMessageId }, data: { status } });
  }
}

export class PrismaSessionStore implements SessionStore {
  constructor(private readonly prisma: PrismaClient) {}

  async get(tenantId: string, waId: string): Promise<SessionState | null> {
    const row = await this.prisma.session.findUnique({ where: { tenantId_waId: { tenantId, waId } } });
    if (!row) return null;
    if (row.expiresAt.getTime() < Date.now()) {
      await this.delete(tenantId, waId);
      return null;
    }
    return row.state as unknown as SessionState;
  }

  async set(tenantId: string, waId: string, session: SessionState, ttlSeconds: number): Promise<void> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const state = session as unknown as Prisma.InputJsonValue;
    await this.prisma.session.upsert({
      where: { tenantId_waId: { tenantId, waId } },
      update: { state, expiresAt },
      create: { tenantId, waId, state, expiresAt },
    });
  }

  async delete(tenantId: string, waId: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { tenantId, waId } });
  }
}

export class PrismaDedupeStore implements DedupeStore {
  constructor(private readonly prisma: PrismaClient) {}

  async claim(key: string, ttlSeconds: number): Promise<boolean> {
    try {
      await this.prisma.processedWebhook.create({ data: { key } });
      // Opportunistic cleanup of old keys; cheap because of the primary key index.
      if (Math.random() < 0.01) {
        await this.prisma.processedWebhook.deleteMany({ where: { receivedAt: { lt: new Date(Date.now() - ttlSeconds * 1000) } } });
      }
      return true;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return false;
      throw err;
    }
  }
}
