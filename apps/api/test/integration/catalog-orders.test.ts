import { addItem, emptyCart } from "@ordr/domain";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { demoCatalog } from "../../src/actions/demo-catalog";
import { PrismaCatalogRepository, PrismaOrderRepository } from "../../src/adapters/prisma-catalog";

const prisma = new PrismaClient();
const suffix = Date.now().toString(36);
let tenantId = "";
const ids = { cat: `cat_it_${suffix}`, off: `off_it_${suffix}`, grp: `grp_it_${suffix}`, opt: `opt_it_${suffix}` };

beforeAll(async () => {
  const tenant = await prisma.tenant.create({ data: { name: "Catalog IT", slug: `cat-it-${suffix}`, blueprintId: "restaurant" } });
  tenantId = tenant.id;
  await prisma.category.create({ data: { id: ids.cat, tenantId, name: { en: "Wraps", ar: "لفائف" }, sortOrder: 1 } });
  await prisma.category.create({ data: { id: `${ids.cat}_hidden`, tenantId, name: { en: "Hidden" }, sortOrder: 2, isActive: false } });
  await prisma.offering.create({
    data: {
      id: ids.off,
      tenantId,
      categoryId: ids.cat,
      name: { en: "Falafel Wrap", ar: "لفافة فلافل" },
      priceMinor: 1500,
      modifierGroups: {
        create: {
          id: ids.grp,
          tenantId,
          name: { en: "Size" },
          minSelect: 1,
          options: { create: [{ id: ids.opt, tenantId, name: { en: "Large" }, priceDeltaMinor: 400, sortOrder: 1 }] },
        },
      },
    },
  });
});

afterAll(async () => {
  await prisma.order.deleteMany({ where: { tenantId } });
  await prisma.offering.deleteMany({ where: { tenantId } });
  await prisma.category.deleteMany({ where: { tenantId } });
  await prisma.tenant.delete({ where: { id: tenantId } });
  await prisma.$disconnect();
});

describe("Prisma catalog and order repositories", () => {
  it("lists active categories and offerings with modifier groups", async () => {
    const repo = new PrismaCatalogRepository(prisma);
    const categories = await repo.listCategories(tenantId);
    expect(categories.map((c) => c.id)).toEqual([ids.cat]);
    const offerings = await repo.listOfferings(tenantId, ids.cat);
    expect(offerings[0]).toMatchObject({ id: ids.off, priceMinor: 1500, name: { en: "Falafel Wrap" } });
    expect(offerings[0]?.modifierGroups[0]?.options[0]).toMatchObject({ id: ids.opt, priceDeltaMinor: 400 });
    expect(await repo.getOffering(tenantId, "missing")).toBeNull();
    expect(await repo.getOffering("other-tenant", ids.off)).toBeNull();
  });

  it("creates orders with per-tenant numbers, items and history", async () => {
    const repo = new PrismaOrderRepository(prisma);
    const cart = addItem(emptyCart("AED"), {
      offeringId: ids.off,
      title: "Falafel Wrap",
      quantity: 2,
      unitPriceMinor: 1500,
      modifiers: [{ groupId: ids.grp, optionId: ids.opt, title: "Large", priceDeltaMinor: 400 }],
    });
    const base = {
      tenantId,
      customerId: "cust_it",
      kind: "order" as const,
      initialStatus: "placed",
      fulfillmentType: "delivery",
      source: "whatsapp" as const,
      items: cart.items,
      currency: "AED",
      subtotalMinor: cart.subtotalMinor,
      deliveryFeeMinor: 1000,
      vatMinor: 229,
      totalMinor: cart.subtotalMinor + 1000,
      paymentStatus: "unpaid" as const,
      deliveryLocation: { latitude: 25.1, longitude: 55.2, notes: "Flat 4" },
    };
    const first = await repo.create(base);
    const second = await repo.create({ ...base, deliveryLocation: undefined, fulfillmentType: "pickup", deliveryFeeMinor: 0, totalMinor: cart.subtotalMinor });
    expect([first.number, second.number]).toEqual([1, 2]);
    expect(first.items[0]).toMatchObject({ offeringId: ids.off, quantity: 2, lineTotalMinor: 3800, modifiers: [{ optionId: ids.opt }] });
    expect(first.deliveryLocation).toMatchObject({ latitude: 25.1, notes: "Flat 4" });
    expect(second.deliveryLocation).toBeUndefined();

    const latest = await repo.latestForCustomer(tenantId, "cust_it");
    expect(latest?.id).toBe(second.id);

    const updated = await repo.updateStatus(tenantId, first.id, "accepted", { type: "order.status_changed", payload: { to: "accepted" } });
    expect(updated.status).toBe("accepted");
    const events = await prisma.orderEvent.findMany({ where: { orderId: first.id }, orderBy: { createdAt: "asc" } });
    expect(events.map((e) => e.type)).toEqual(["order.placed", "order.status_changed"]);

    expect((await repo.listByStatus(tenantId, ["placed"])).map((o) => o.id)).toEqual([second.id]);
  });

  it("seeds the demo catalog shape consistently", () => {
    const demo = demoCatalog("t");
    expect(demo.categories).toHaveLength(4);
    expect(demo.offerings.find((o) => o.id === "it_chicken_shawarma")?.modifierGroups.map((g) => g.id)).toEqual(["sh_chk_size", "sh_chk_extras"]);
  });
});
