import { formatMoney, vatIncludedIn, vatOnTopOf } from "./money";

export interface CartModifier {
  groupId: string;
  optionId: string;
  title: string;
  priceDeltaMinor: number;
}

export interface CartItem {
  offeringId: string;
  title: string;
  quantity: number;
  unitPriceMinor: number;
  modifiers: CartModifier[];
  /** quantity x (unit price + modifier deltas). */
  lineTotalMinor: number;
  notes?: string;
}

export interface Cart {
  currency: string;
  items: CartItem[];
  subtotalMinor: number;
}

export function emptyCart(currency: string): Cart {
  return { currency, items: [], subtotalMinor: 0 };
}

function unitWithModifiers(item: Pick<CartItem, "unitPriceMinor" | "modifiers">): number {
  return item.unitPriceMinor + item.modifiers.reduce((n, m) => n + m.priceDeltaMinor, 0);
}

function sameLine(a: CartItem, b: Omit<CartItem, "lineTotalMinor">): boolean {
  if (a.offeringId !== b.offeringId || a.notes !== b.notes) return false;
  const ids = (m: CartModifier[]) => m.map((x) => x.optionId).sort().join(",");
  return ids(a.modifiers) === ids(b.modifiers);
}

function recompute(items: CartItem[], currency: string): Cart {
  const withTotals = items.map((i) => ({ ...i, lineTotalMinor: i.quantity * unitWithModifiers(i) }));
  return { currency, items: withTotals, subtotalMinor: withTotals.reduce((n, i) => n + i.lineTotalMinor, 0) };
}

/** Adds a line, merging into an identical existing line (same offering, modifiers and notes). */
export function addItem(cart: Cart, item: Omit<CartItem, "lineTotalMinor">): Cart {
  if (item.quantity < 1) throw new Error("quantity must be at least 1");
  const items = cart.items.map((i) => ({ ...i }));
  const existing = items.find((i) => sameLine(i, item));
  if (existing) existing.quantity += item.quantity;
  else items.push({ ...item, lineTotalMinor: 0 });
  return recompute(items, cart.currency);
}

export function removeItem(cart: Cart, index: number): Cart {
  return recompute(
    cart.items.filter((_, i) => i !== index),
    cart.currency,
  );
}

export function cartCount(cart: Cart): number {
  return cart.items.reduce((n, i) => n + i.quantity, 0);
}

/** Human readable lines, one per item, for WhatsApp text messages. */
export function describeCart(cart: Cart): string {
  if (cart.items.length === 0) return "";
  return cart.items
    .map((i) => {
      const mods = i.modifiers.length ? ` (${i.modifiers.map((m) => m.title).join(", ")})` : "";
      return `${i.quantity} x ${i.title}${mods}  ${formatMoney(i.lineTotalMinor, cart.currency)}`;
    })
    .join("\n");
}

export interface Quote {
  currency: string;
  fulfillmentType: string;
  subtotalMinor: number;
  deliveryFeeMinor: number;
  /** VAT amount; included in total when vatInclusive, added on top otherwise. */
  vatMinor: number;
  vatInclusive: boolean;
  totalMinor: number;
}

export interface QuoteOptions {
  fulfillmentType: string;
  deliveryFeeMinor?: number;
  vatRate?: number;
  /** UAE menu prices are normally VAT inclusive. */
  vatInclusive?: boolean;
}

export function quote(cart: Cart, opts: QuoteOptions): Quote {
  const deliveryFeeMinor = opts.fulfillmentType === "delivery" ? (opts.deliveryFeeMinor ?? 0) : 0;
  const vatRate = opts.vatRate ?? 0;
  const vatInclusive = opts.vatInclusive ?? true;
  const net = cart.subtotalMinor + deliveryFeeMinor;
  const vatMinor = vatInclusive ? vatIncludedIn(net, vatRate) : vatOnTopOf(net, vatRate);
  const totalMinor = vatInclusive ? net : net + vatMinor;
  return { currency: cart.currency, fulfillmentType: opts.fulfillmentType, subtotalMinor: cart.subtotalMinor, deliveryFeeMinor, vatMinor, vatInclusive, totalMinor };
}
