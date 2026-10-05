import type { Channel, Customer, Tenant } from "@ordr/domain";
import type { Blueprint, SessionState } from "@ordr/flow-schema";

export interface TenantContext {
  tenant: Tenant;
  channel: Channel;
}

export interface TenantRepository {
  findByPhoneNumberId(phoneNumberId: string): Promise<TenantContext | null>;
}

export type ConversationStatus = "bot" | "human" | "closed";

export interface ConversationRecord {
  id: string;
  tenantId: string;
  customerId: string;
  channelId: string;
  status: ConversationStatus;
}

export interface MessageRecord {
  tenantId: string;
  conversationId: string;
  direction: "in" | "out";
  providerMessageId?: string;
  kind: string;
  payload: unknown;
  createdAt: Date;
}

export interface ConversationRepository {
  upsertCustomer(tenantId: string, waId: string, name?: string): Promise<Customer>;
  setCustomerLanguage(customerId: string, language: string): Promise<void>;
  getOrCreateOpenConversation(tenantId: string, customerId: string, channelId: string): Promise<ConversationRecord>;
  setConversationStatus(conversationId: string, status: ConversationStatus): Promise<void>;
  touchInbound(conversationId: string, at: Date): Promise<void>;
  recordMessage(message: MessageRecord): Promise<void>;
  updateMessageStatus(providerMessageId: string, status: string): Promise<void>;
}

export interface SessionStore {
  get(tenantId: string, waId: string): Promise<SessionState | null>;
  set(tenantId: string, waId: string, session: SessionState, ttlSeconds: number): Promise<void>;
  delete(tenantId: string, waId: string): Promise<void>;
}

export interface DedupeStore {
  /** Returns true the first time a key is seen within the TTL, false afterwards. */
  claim(key: string, ttlSeconds: number): Promise<boolean>;
}

export interface BlueprintRegistry {
  get(id: string): Blueprint | undefined;
}
