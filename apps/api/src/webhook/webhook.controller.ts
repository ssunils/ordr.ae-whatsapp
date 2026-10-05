import { Controller, Get, Headers, HttpCode, Inject, Logger, Post, Query, type RawBodyRequest, Req, Res } from "@nestjs/common";
import { parseWebhook, verifySignature, verifyWebhookChallenge, type WebhookPayload } from "@ordr/whatsapp";
import type { Request, Response } from "express";
import type { AppConfig } from "../config";
import { ConversationService } from "../conversation/conversation.service";
import { InboundQueue } from "../conversation/inbound-queue";
import { TOKENS } from "../tokens";

@Controller("webhooks/whatsapp")
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    @Inject(TOKENS.Config) private readonly config: AppConfig,
    @Inject(ConversationService) private readonly conversations: ConversationService,
    @Inject(InboundQueue) private readonly queue: InboundQueue,
  ) {}

  /** Meta's one-time verification handshake when the webhook URL is registered. */
  @Get()
  verify(@Query() query: Record<string, string>, @Res() res: Response): void {
    const challenge = verifyWebhookChallenge(query, this.config.META_VERIFY_TOKEN);
    if (challenge === null) {
      res.status(403).send("verification failed");
      return;
    }
    res.status(200).type("text/plain").send(challenge);
  }

  /**
   * Meta retries anything that is not a 2xx within a few seconds, so this acknowledges first
   * and processes afterwards. Dedupe in ConversationService absorbs the retries that still happen.
   */
  @Post()
  @HttpCode(200)
  receive(
    @Req() req: RawBodyRequest<Request>,
    @Headers("x-hub-signature-256") signature: string | undefined,
    @Res() res: Response,
  ): void {
    const raw = req.rawBody;
    if (!raw || !verifySignature(raw, signature, this.config.META_APP_SECRET)) {
      this.logger.warn("rejected webhook with missing or invalid signature");
      res.status(401).send("invalid signature");
      return;
    }
    res.status(200).send("ok");

    let events;
    try {
      events = parseWebhook(req.body as WebhookPayload);
    } catch (err) {
      this.logger.error(`could not parse webhook: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    for (const event of events) {
      const key = event.type === "message" ? `${event.phoneNumberId}:${event.from}` : `${event.phoneNumberId}:status`;
      this.queue.enqueue(key, () => this.conversations.handleEvent(event));
    }
  }
}
