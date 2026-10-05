import type { RawMessage, WebhookPayload } from "./webhook-types";

/** Builders for realistic webhook payloads. Used by tests and the simulator. */

export interface FixtureBase {
  phoneNumberId?: string;
  displayPhone?: string;
  wabaId?: string;
  from?: string;
  profileName?: string;
  messageId?: string;
  timestamp?: number;
}

let seq = 0;

function envelope(base: FixtureBase, message: Omit<RawMessage, "from" | "id" | "timestamp">): WebhookPayload {
  const from = base.from ?? "971500000001";
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: base.wabaId ?? "100000000000000",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: base.displayPhone ?? "971500000000",
                phone_number_id: base.phoneNumberId ?? "200000000000000",
              },
              contacts: [{ profile: { name: base.profileName ?? "Test User" }, wa_id: from }],
              messages: [
                {
                  from,
                  id: base.messageId ?? `wamid.test.${++seq}`,
                  timestamp: String(base.timestamp ?? Math.floor(Date.now() / 1000)),
                  ...message,
                } as RawMessage,
              ],
            },
          },
        ],
      },
    ],
  };
}

export function textMessageWebhook(text: string, base: FixtureBase = {}): WebhookPayload {
  return envelope(base, { type: "text", text: { body: text } } as RawMessage);
}

export function buttonReplyWebhook(id: string, title: string, base: FixtureBase = {}): WebhookPayload {
  return envelope(base, {
    type: "interactive",
    interactive: { type: "button_reply", button_reply: { id, title } },
  } as RawMessage);
}

export function listReplyWebhook(id: string, title: string, base: FixtureBase = {}): WebhookPayload {
  return envelope(base, {
    type: "interactive",
    interactive: { type: "list_reply", list_reply: { id, title } },
  } as RawMessage);
}

export function locationWebhook(latitude: number, longitude: number, base: FixtureBase = {}): WebhookPayload {
  return envelope(base, { type: "location", location: { latitude, longitude } } as RawMessage);
}

export function statusWebhook(
  messageId: string,
  status: "sent" | "delivered" | "read" | "failed",
  base: FixtureBase = {},
): WebhookPayload {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: base.wabaId ?? "100000000000000",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: base.displayPhone ?? "971500000000",
                phone_number_id: base.phoneNumberId ?? "200000000000000",
              },
              statuses: [
                {
                  id: messageId,
                  status,
                  timestamp: String(base.timestamp ?? Math.floor(Date.now() / 1000)),
                  recipient_id: base.from ?? "971500000001",
                },
              ],
            },
          },
        ],
      },
    ],
  };
}
