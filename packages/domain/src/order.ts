import type { OfferingId, OrderId, ResourceId, TenantId } from "./ids";

/**
 * One Order type serves every vertical. A salon booking is an Order with a slot and a
 * resource; a food order is an Order whose constraint is kitchen capacity.
 */
export type OrderKind = "order" | "booking" | "appointment";

export interface OrderItem {
  offeringId: OfferingId;
  title: string;
  quantity: number;
  unitPrice: number;
  modifiers?: Array<{ id: string; title: string; price: number }>;
  notes?: string;
}

export interface Order {
  id: OrderId;
  tenantId: TenantId;
  kind: OrderKind;
  /** Status is blueprint-defined; see StateMachine. */
  status: string;
  fulfillmentType: string;
  source: "whatsapp" | "pos" | "web";
  customerId: string;
  items: OrderItem[];
  resourceId?: ResourceId;
  scheduledAt?: string;
  currency: string;
  subtotal: number;
  total: number;
  paymentStatus: "unpaid" | "pending" | "paid" | "refunded";
}
