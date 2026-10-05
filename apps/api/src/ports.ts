import type { Category, Channel, Customer, DomainEvent, Offering, Order, OrderItem, OrderKind, OrderSource, PaymentStatus, DeliveryLocation, Tenant } from "@ordr/domain";
import type { Blueprint, SessionState } from "@ordr/flow-schema";

export interface TenantContext {
  tenant: Tenant;
  channel: Channel;
}

export interface TenantRepository {
  findByPhoneNumberId(phoneNumberId: string): Promise<TenantContext | null>;
  findById(tenantId: string): Promise<Tenant | null>;
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

export interface CatalogRepository {
  /** Active categories in display order. */
  listCategories(tenantId: string): Promise<Category[]>;
  /** Active offerings of a category in display order, with modifier groups. */
  listOfferings(tenantId: string, categoryId: string): Promise<Offering[]>;
  getOffering(tenantId: string, offeringId: string): Promise<Offering | null>;
}

export interface CreateOrderInput {
  tenantId: string;
  customerId: string;
  conversationId?: string;
  kind: OrderKind;
  initialStatus: string;
  fulfillmentType: string;
  source: OrderSource;
  items: OrderItem[];
  currency: string;
  subtotalMinor: number;
  deliveryFeeMinor: number;
  vatMinor: number;
  totalMinor: number;
  paymentStatus: PaymentStatus;
  paymentMethod?: string;
  deliveryLocation?: DeliveryLocation;
  notes?: string;
}

export interface OrderRepository {
  /** Assigns the next per-tenant order number and records an "order.placed" history entry. */
  create(input: CreateOrderInput): Promise<Order>;
  findById(tenantId: string, orderId: string): Promise<Order | null>;
  latestForCustomer(tenantId: string, customerId: string): Promise<Order | null>;
  updateStatus(tenantId: string, orderId: string, status: string, event: { type: string; payload?: unknown }): Promise<Order>;
  listByStatus(tenantId: string, statuses: string[], limit?: number): Promise<Order[]>;
}

export type EventHandler = (event: DomainEvent) => Promise<void> | void;

/** In-process for now. The outbox relay and a broker replace the implementation, not the port. */
export interface EventBus {
  publish(event: DomainEvent): Promise<void>;
  subscribe(type: string | "*", handler: EventHandler): () => void;
}
