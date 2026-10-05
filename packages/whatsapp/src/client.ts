import type { OutboundMessage } from "./outbound";
import type { MessageSender, SendResult, SendTarget } from "./sender";

export interface CloudApiClientOptions {
  graphVersion?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  /** Request timeout in milliseconds. */
  timeoutMs?: number;
}

export class CloudApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: number | undefined,
    public readonly subcode: number | undefined,
    message: string,
    public readonly fbtraceId?: string,
  ) {
    super(message);
    this.name = "CloudApiError";
  }
}

/** Minimal Meta WhatsApp Cloud API client. One instance serves every tenant; tokens travel with each call. */
export class CloudApiClient implements MessageSender {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(opts: CloudApiClientOptions = {}) {
    const version = opts.graphVersion ?? "v23.0";
    this.baseUrl = opts.baseUrl ?? `https://graph.facebook.com/${version}`;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? 10_000;
  }

  async send(target: SendTarget, message: OutboundMessage): Promise<SendResult> {
    const body = { messaging_product: "whatsapp", recipient_type: "individual", to: target.to, ...message };
    const res = await this.post<{ messages: Array<{ id: string }> }>(target.phoneNumberId, target.accessToken, body);
    const id = res.messages?.[0]?.id;
    if (!id) throw new CloudApiError(200, undefined, undefined, "Cloud API response did not include a message id");
    return { providerMessageId: id };
  }

  async markRead(target: Omit<SendTarget, "to">, messageId: string): Promise<void> {
    await this.post(target.phoneNumberId, target.accessToken, {
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    });
  }

  private async post<T>(phoneNumberId: string, accessToken: string, body: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/${phoneNumberId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: { message: string; code?: number; error_subcode?: number; fbtrace_id?: string };
      } & T;
      if (!res.ok || json.error) {
        const e = json.error;
        throw new CloudApiError(res.status, e?.code, e?.error_subcode, e?.message ?? `HTTP ${res.status}`, e?.fbtrace_id);
      }
      return json;
    } finally {
      clearTimeout(timer);
    }
  }
}
