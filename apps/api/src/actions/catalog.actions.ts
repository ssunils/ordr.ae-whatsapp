import { formatMoney, localized } from "@ordr/domain";
import type { DynamicRow, MapActionRegistry } from "@ordr/flow-schema";
import type { CatalogRepository } from "../ports";

export function registerCatalogActions(registry: MapActionRegistry, catalog: CatalogRepository): void {
  registry.register("catalog.categories", async (_params, ctx): Promise<DynamicRow[]> => {
    const categories = await catalog.listCategories(ctx.tenantId);
    return categories.map((c) => ({ id: c.id, title: localized(c.name, ctx.language) }));
  });

  registry.register("catalog.items", async (params, ctx): Promise<DynamicRow[]> => {
    const offerings = await catalog.listOfferings(ctx.tenantId, String(params.categoryId ?? ""));
    return offerings.map((o) => {
      const desc = localized(o.description, ctx.language);
      return {
        id: o.id,
        title: localized(o.name, ctx.language),
        description: desc ? `${formatMoney(o.priceMinor, o.currency)}, ${desc}` : formatMoney(o.priceMinor, o.currency),
      };
    });
  });
}
