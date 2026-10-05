/** Raw Meta Cloud API webhook payload shapes (subset we handle). */

export interface WebhookPayload {
  object: "whatsapp_business_account";
  entry: WebhookEntry[];
}

export interface WebhookEntry {
  id: string;
  changes: WebhookChange[];
}

export interface WebhookChange {
  field: "messages" | string;
  value: WebhookValue;
}

export interface WebhookValue {
  messaging_product: "whatsapp";
  metadata: { display_phone_number: string; phone_number_id: string };
  contacts?: Array<{ profile: { name: string }; wa_id: string }>;
  messages?: RawMessage[];
  statuses?: RawStatus[];
  errors?: RawError[];
}

export interface RawError {
  code: number;
  title: string;
  message?: string;
  error_data?: { details: string };
}

export interface RawMessageBase {
  from: string;
  id: string;
  timestamp: string;
  context?: { from: string; id: string };
}

export type RawMessage =
  | (RawMessageBase & { type: "text"; text: { body: string } })
  | (RawMessageBase & {
      type: "interactive";
      interactive:
        | { type: "button_reply"; button_reply: { id: string; title: string } }
        | { type: "list_reply"; list_reply: { id: string; title: string; description?: string } }
        | { type: "nfm_reply"; nfm_reply: { name: string; body: string; response_json: string } };
    })
  | (RawMessageBase & { type: "button"; button: { payload: string; text: string } })
  | (RawMessageBase & {
      type: "location";
      location: { latitude: number; longitude: number; name?: string; address?: string };
    })
  | (RawMessageBase & {
      type: "order";
      order: {
        catalog_id: string;
        text?: string;
        product_items: Array<{
          product_retailer_id: string;
          quantity: number;
          item_price: number;
          currency: string;
        }>;
      };
    })
  | (RawMessageBase & { type: "image"; image: RawMedia })
  | (RawMessageBase & { type: "video"; video: RawMedia })
  | (RawMessageBase & { type: "audio"; audio: RawMedia })
  | (RawMessageBase & { type: "document"; document: RawMedia & { filename?: string } })
  | (RawMessageBase & { type: "sticker"; sticker: RawMedia })
  | (RawMessageBase & { type: "reaction"; reaction: { message_id: string; emoji: string } })
  | (RawMessageBase & { type: "unsupported"; errors?: RawError[] });

export interface RawMedia {
  id: string;
  mime_type: string;
  sha256?: string;
  caption?: string;
}

export interface RawStatus {
  id: string;
  status: "sent" | "delivered" | "read" | "failed" | "deleted";
  timestamp: string;
  recipient_id: string;
  conversation?: {
    id: string;
    origin: { type: string };
    expiration_timestamp?: string;
  };
  pricing?: { billable: boolean; pricing_model: string; category: string };
  errors?: RawError[];
}
