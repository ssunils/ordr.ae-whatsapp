import type { Category, Offering } from "@ordr/domain";

/**
 * Demo menu used by the in-memory catalog (simulator, tests) and by the Prisma seed.
 * Ids are stable so tests can reference them.
 */
export function demoCatalog(tenantId: string): { categories: Category[]; offerings: Offering[] } {
  const categories: Category[] = [
    { id: "cat_shawarma", tenantId, name: { en: "Shawarma", ar: "شاورما" }, sortOrder: 1, isActive: true },
    { id: "cat_burgers", tenantId, name: { en: "Burgers", ar: "برجر" }, sortOrder: 2, isActive: true },
    { id: "cat_sides", tenantId, name: { en: "Sides", ar: "أطباق جانبية" }, sortOrder: 3, isActive: true },
    { id: "cat_drinks", tenantId, name: { en: "Drinks", ar: "مشروبات" }, sortOrder: 4, isActive: true },
  ];

  const size = (prefix: string) => ({
    id: `${prefix}_size`,
    name: { en: "Size", ar: "الحجم" },
    minSelect: 1,
    maxSelect: 1,
    sortOrder: 1,
    options: [
      { id: `${prefix}_size_regular`, name: { en: "Regular", ar: "عادي" }, priceDeltaMinor: 0, sortOrder: 1, isActive: true },
      { id: `${prefix}_size_large`, name: { en: "Large", ar: "كبير" }, priceDeltaMinor: 500, sortOrder: 2, isActive: true },
    ],
  });
  const extras = (prefix: string) => ({
    id: `${prefix}_extras`,
    name: { en: "Extras", ar: "إضافات" },
    minSelect: 0,
    maxSelect: 1,
    sortOrder: 2,
    options: [
      { id: `${prefix}_extra_garlic`, name: { en: "Extra garlic", ar: "ثوم إضافي" }, priceDeltaMinor: 200, sortOrder: 1, isActive: true },
      { id: `${prefix}_extra_pickles`, name: { en: "Extra pickles", ar: "مخلل إضافي" }, priceDeltaMinor: 0, sortOrder: 2, isActive: true },
    ],
  });

  const product = (
    id: string,
    categoryId: string,
    name: Record<string, string>,
    priceMinor: number,
    sortOrder: number,
    description?: Record<string, string>,
    modifierGroups: Offering["modifierGroups"] = [],
  ): Offering => ({ id, tenantId, categoryId, type: "product", name, description, priceMinor, currency: "AED", sortOrder, isActive: true, modifierGroups });

  const offerings: Offering[] = [
    product("it_chicken_shawarma", "cat_shawarma", { en: "Chicken Shawarma", ar: "شاورما دجاج" }, 1800, 1, { en: "Garlic, pickles, fries", ar: "ثوم، مخلل، بطاطا" }, [size("sh_chk"), extras("sh_chk")]),
    product("it_beef_shawarma", "cat_shawarma", { en: "Beef Shawarma", ar: "شاورما لحم" }, 2200, 2, { en: "Tahini, onion, parsley", ar: "طحينة، بصل، بقدونس" }, [size("sh_beef"), extras("sh_beef")]),
    product("it_shawarma_plate", "cat_shawarma", { en: "Shawarma Plate", ar: "صحن شاورما" }, 3500, 3, { en: "With fries and garlic", ar: "مع بطاطا وثوم" }),
    product("it_classic_burger", "cat_burgers", { en: "Classic Burger", ar: "برجر كلاسيك" }, 3200, 1, { en: "Beef, cheddar, house sauce", ar: "لحم، شيدر، صلصة" }),
    product("it_double_smash", "cat_burgers", { en: "Double Smash", ar: "دبل سماش" }, 4200, 2),
    product("it_fries", "cat_sides", { en: "Fries", ar: "بطاطا مقلية" }, 1200, 1),
    product("it_hummus", "cat_sides", { en: "Hummus", ar: "حمص" }, 1400, 2),
    product("it_cola", "cat_drinks", { en: "Cola", ar: "كولا" }, 800, 1, undefined, [size("drk_cola")]),
    product("it_lemon_mint", "cat_drinks", { en: "Lemon Mint", ar: "ليمون بالنعناع" }, 1500, 2),
  ];

  return { categories, offerings };
}
