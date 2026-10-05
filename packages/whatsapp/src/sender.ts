import type { OutboundMessage } from "./outbound";

export interface SendTarget {
  /** Business number to send from (Meta phone_number_id). */
  phoneNumberId: string;
  accessToken: string;
  /** Customer wa_id. */
  to: string;
}

export interface SendResult {
  providerMessageId: string;
}

/** Anything that can deliver an outbound message. Implemented by the Cloud API client and by fakes. */
export interface MessageSender {
  send(target: SendTarget, message: OutboundMessage): Promise<SendResult>;
  markRead?(target: Omit<SendTarget, "to">, messageId: string): Promise<void>;
}

export interface SentRecord {
  target: SendTarget;
  message: OutboundMessage;
  providerMessageId: string;
}

/** Records every send in memory. Used by tests and the local simulator. */
export class FakeSender implements MessageSender {
  public readonly sent: SentRecord[] = [];
  private counter = 0;

  async send(target: SendTarget, message: OutboundMessage): Promise<SendResult> {
    const providerMessageId = `wamid.fake.${++this.counter}`;
    this.sent.push({ target, message, providerMessageId });
    return { providerMessageId };
  }

  async markRead(): Promise<void> {}

  /** Messages sent to one recipient, oldest first. */
  to(waId: string): OutboundMessage[] {
    return this.sent.filter((s) => s.target.to === waId).map((s) => s.message);
  }

  clear(): void {
    this.sent.length = 0;
  }
}

/** Prints outbound messages to stdout. Handy for running the API without a WhatsApp number. */
export class LoggingSender implements MessageSender {
  private counter = 0;
  constructor(private readonly log: (line: string) => void = (l) => console.log(l)) {}

  async send(target: SendTarget, message: OutboundMessage): Promise<SendResult> {
    this.log(`[outbound to ${target.to}] ${JSON.stringify(message)}`);
    return { providerMessageId: `wamid.log.${++this.counter}` };
  }

  async markRead(): Promise<void> {}
}
