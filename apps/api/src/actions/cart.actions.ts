import { addItem, type Cart, type CartModifier, cartCount, describeCart, emptyCart, formatMoney, localized } from "@ordr/domain";
import { type DynamicRow, FlowRunnerError, type MapActionRegistry } from "@ordr/flow-schema";
import type { CatalogRepository } from "../ports";
import { COPY, t } from "./copy";

/** A line being configured before it is added to the cart; lives in the session context as `line`. */
export interface PendingLine {
  offeringId: string;
  title: string;
  currency: string;
  unitPriceMinor: number;
  modifiers: CartModifier[];
  /** Modifier groups still to be answered, in order. Rows carry the price delta alongside what the list shows. */
  groups: Array<{ id: string; title: string; required: boolean; rows: ModifierRow[] }>;
}

export interface CartSummary {
  count: number;
  subtotal: string;
  lines: string;
  text: string;
}

export type ModifierRow = DynamicRow & { priceDeltaMinor: number };

const SKIP = "__skip";

export function summarizeCart(cart: Cart | undefined, language: string): CartSummary {
  if (!cart || cart.items.length === 0) {
    return { count: 0, subtotal: formatMoney(0, cart?.currency ?? "AED"), lines: "", text: t(COPY.cartEmpty, language) };
  }
  const lines = describeCart(cart);
  const subtotal = formatMoney(cart.subtotalMinor, cart.currency);
  return {
    count: cartCount(cart),
    subtotal,
    lines,
    text: `${t(COPY.cartTitle, language)}\n${lines}\n\n${t(COPY.subtotal, language)}: ${subtotal}`,
  };
}

export function registerCartActions(registry: MapActionRegistry, catalog: CatalogRepository): void {
  registry.register("cart.start_line", async (params, ctx): Promise<PendingLine> => {
    const offering = await catalog.getOffering(ctx.tenantId, String(params.offeringId ?? ""));
    if (!offering || !offering.isActive) throw new FlowRunnerError(`offering ${String(params.offeringId)} not available`);
    return {
      offeringId: offering.id,
      title: localized(offering.name, ctx.language),
      currency: offering.currency,
      unitPriceMinor: offering.priceMinor,
      modifiers: [],
      groups: offering.modifierGroups
        .filter((g) => g.options.some((o) => o.isActive))
        .map((g) => {
          const rows: ModifierRow[] = g.options
            .filter((o) => o.isActive)
            .map((o) => ({
              id: o.id,
              title: localized(o.name, ctx.language),
              description: o.priceDeltaMinor ? `+ ${formatMoney(o.priceDeltaMinor, offering.currency)}` : undefined,
              priceDeltaMinor: o.priceDeltaMinor,
            }));
          if (g.minSelect === 0) rows.push({ id: SKIP, title: t(COPY.noThanks, ctx.language), priceDeltaMinor: 0 });
          return { id: g.id, title: localized(g.name, ctx.language), required: g.minSelect > 0, rows };
        }),
    };
  });

  registry.register("cart.next_modifier_group", async (_params, ctx) => {
    const line = ctx.context.line as PendingLine | undefined;
    return line?.groups[0] ?? null;
  });

  registry.register("cart.select_modifier", async (params, ctx): Promise<PendingLine> => {
    const line = ctx.context.line as PendingLine | undefined;
    if (!line) throw new FlowRunnerError("no pending line in session");
    const groupId = String(params.groupId ?? "");
    const optionId = String(params.optionId ?? "");
    const group = line.groups.find((g) => g.id === groupId);
    if (!group) throw new FlowRunnerError(`modifier group ${groupId} is not pending`);
    const remaining = line.groups.filter((g) => g.id !== groupId);
    if (optionId === SKIP) return { ...line, groups: remaining };
    const row = group.rows.find((r) => r.id === optionId);
    if (!row) throw new FlowRunnerError(`option ${optionId} not in group ${groupId}`);
    const modifier: CartModifier = { groupId, optionId, title: row.title, priceDeltaMinor: row.priceDeltaMinor };
    return { ...line, modifiers: [...line.modifiers, modifier], groups: remaining };
  });

  registry.register("cart.add", async (params, ctx): Promise<Cart> => {
    const line = ctx.context.line as PendingLine | undefined;
    if (!line) throw new FlowRunnerError("no pending line in session");
    const quantity = Number(params.quantity ?? 1);
    if (!Number.isInteger(quantity) || quantity < 1) throw new FlowRunnerError(`invalid quantity ${String(params.quantity)}`);
    const cart = (ctx.context.cart as Cart | undefined) ?? emptyCart(line.currency);
    return addItem(cart, {
      offeringId: line.offeringId,
      title: line.title,
      quantity,
      unitPriceMinor: line.unitPriceMinor,
      modifiers: line.modifiers,
    });
  });

  registry.register("cart.summary", async (_params, ctx): Promise<CartSummary> => summarizeCart(ctx.context.cart as Cart | undefined, ctx.language));

  registry.register("cart.clear", async (_params, ctx): Promise<Cart> => emptyCart(((ctx.context.cart as Cart | undefined)?.currency ?? "AED")));
}
