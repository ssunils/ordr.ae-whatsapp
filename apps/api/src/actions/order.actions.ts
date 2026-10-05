import { type Cart, type DeliveryLocation, formatMoney } from "@ordr/domain";
import { FlowRunnerError, type MapActionRegistry } from "@ordr/flow-schema";
import type { OrderService } from "../orders/order.service";
import { summarizeCart } from "./cart.actions";
import { COPY, statusLabel, t } from "./copy";

export function registerOrderActions(registry: MapActionRegistry, orders: OrderService): void {
  registry.register("orders.quote", async (params, ctx) => {
    const cart = ctx.context.cart as Cart | undefined;
    if (!cart || cart.items.length === 0) throw new FlowRunnerError("cart is empty");
    const fulfillmentType = String(params.fulfillmentType ?? "pickup");
    const q = await orders.quote(ctx.tenantId, cart, fulfillmentType);
    const lang = ctx.language;
    const lines = [summarizeCart(cart, lang).lines, "", `${t(COPY.subtotal, lang)}: ${formatMoney(q.subtotalMinor, q.currency)}`];
    if (q.deliveryFeeMinor > 0) lines.push(`${t(COPY.deliveryFee, lang)}: ${formatMoney(q.deliveryFeeMinor, q.currency)}`);
    if (!q.vatInclusive && q.vatMinor > 0) lines.push(`${t(COPY.vat, lang)}: ${formatMoney(q.vatMinor, q.currency)}`);
    lines.push(`${t(COPY.total, lang)}: ${formatMoney(q.totalMinor, q.currency)}`);
    if (q.vatInclusive && q.vatMinor > 0) lines.push(`(${t(COPY.vatIncluded, lang)} ${formatMoney(q.vatMinor, q.currency)})`);
    return {
      ...q,
      subtotal: formatMoney(q.subtotalMinor, q.currency),
      deliveryFee: formatMoney(q.deliveryFeeMinor, q.currency),
      vat: formatMoney(q.vatMinor, q.currency),
      total: formatMoney(q.totalMinor, q.currency),
      text: lines.join("\n"),
    };
  });

  registry.register("orders.create", async (params, ctx) => {
    const cart = ctx.context.cart as Cart | undefined;
    if (!cart || cart.items.length === 0) throw new FlowRunnerError("cart is empty");
    if (!ctx.customer.id) throw new FlowRunnerError("customer id missing from action context");
    const fulfillmentType = String(params.fulfillmentType ?? "pickup");
    const location = ctx.context.deliveryLocation as DeliveryLocation | undefined;
    const notes = typeof ctx.context.deliveryNotes === "string" ? ctx.context.deliveryNotes : undefined;
    const order = await orders.place({
      tenantId: ctx.tenantId,
      customerId: ctx.customer.id,
      conversationId: ctx.conversationId,
      cart,
      fulfillmentType,
      deliveryLocation: fulfillmentType === "delivery" ? location : undefined,
      notes,
    });
    // The cart is consumed by the order.
    delete ctx.context.cart;
    const lang = ctx.language;
    const total = formatMoney(order.totalMinor, order.currency);
    const pay = order.fulfillmentType === "delivery" ? COPY.payCashDelivery : COPY.payCashPickup;
    return {
      id: order.id,
      number: order.number,
      status: order.status,
      total,
      text: [t(COPY.orderPlaced, lang, { number: order.number }), t(pay, lang, { total }), t(COPY.weWillUpdate, lang)].join(" "),
    };
  });

  registry.register("orders.latest", async (_params, ctx) => {
    if (!ctx.customer.id) return null;
    const order = await orders.latestForCustomer(ctx.tenantId, ctx.customer.id);
    if (!order) return null;
    const total = formatMoney(order.totalMinor, order.currency);
    return {
      id: order.id,
      number: order.number,
      status: order.status,
      total,
      text: t(COPY.orderStatus, ctx.language, { number: order.number, status: statusLabel(order.status, ctx.language), total }),
    };
  });
}
