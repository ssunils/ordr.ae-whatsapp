import { MapActionRegistry } from "@ordr/flow-schema";

/**
 * Static demo catalog so the restaurant blueprint works before the Catalog service exists.
 * Phase 1 replaces these handlers with database-backed ones; the blueprint does not change.
 */
const CATEGORIES = [
  { id: "cat_shawarma", title: "Shawarma", description: "Chicken and beef wraps" },
  { id: "cat_burgers", title: "Burgers", description: "Smashed and grilled" },
  { id: "cat_sides", title: "Sides", description: "Fries, hummus, salads" },
  { id: "cat_drinks", title: "Drinks", description: "Soft drinks and juices" },
];

const ITEMS: Record<string, Array<{ id: string; title: string; description: string }>> = {
  cat_shawarma: [
    { id: "it_chicken_shawarma", title: "Chicken Shawarma", description: "AED 18" },
    { id: "it_beef_shawarma", title: "Beef Shawarma", description: "AED 22" },
    { id: "it_shawarma_plate", title: "Shawarma Plate", description: "AED 35, with fries and garlic" },
  ],
  cat_burgers: [
    { id: "it_classic_burger", title: "Classic Burger", description: "AED 32" },
    { id: "it_double_smash", title: "Double Smash", description: "AED 42" },
  ],
  cat_sides: [
    { id: "it_fries", title: "Fries", description: "AED 12" },
    { id: "it_hummus", title: "Hummus", description: "AED 14" },
  ],
  cat_drinks: [
    { id: "it_cola", title: "Cola", description: "AED 8" },
    { id: "it_lemon_mint", title: "Lemon Mint", description: "AED 15" },
  ],
};

export function createDemoActionRegistry(): MapActionRegistry {
  return new MapActionRegistry()
    .register("catalog.categories", async () => CATEGORIES)
    .register("catalog.items", async (params) => ITEMS[String(params.categoryId ?? "")] ?? [])
    .register("orders.latest", async () => null);
}
