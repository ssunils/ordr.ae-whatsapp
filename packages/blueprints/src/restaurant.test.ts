import { FlowRunner, MapActionRegistry } from "@ordr/flow-schema";
import type { OutboundMessage } from "@ordr/whatsapp";
import { describe, expect, it } from "vitest";
import { restaurant } from "./restaurant";

function body(m: OutboundMessage | undefined): string {
  if (!m) return "";
  if (m.type === "text") return m.text.body;
  if (m.type === "interactive" && "body" in m.interactive) return m.interactive.body.text;
  return m.type;
}

const actions = new MapActionRegistry()
  .register("catalog.categories", async () => [
    { id: "cat_burgers", title: "Burgers" },
    { id: "cat_drinks", title: "Drinks" },
  ])
  .register("catalog.items", async (params) =>
    params.categoryId === "cat_burgers"
      ? [{ id: "it_classic", title: "Classic Burger", description: "AED 32" }]
      : [{ id: "it_cola", title: "Cola", description: "AED 8" }],
  )
  .register("orders.latest", async () => null);

const actionCtx = { tenantId: "t1", customer: { waId: "971500000001", name: "Sara" } };
const context = { tenant: { name: "Demo Restaurant" }, customer: { name: "Sara" } };

describe("restaurant blueprint", () => {
  it("parses and exposes the expected flows", () => {
    expect(restaurant.flows.map((f) => f.id).sort()).toEqual(["language", "main_menu", "order_food", "talk_to_us", "track_order"]);
  });

  it("walks the happy path from greeting to item selection", async () => {
    const runner = new FlowRunner(restaurant, actions);
    const s1 = await runner.start("main_menu", { language: "en", context }, actionCtx);
    expect(body(s1.outbound[0])).toBe("Welcome to Demo Restaurant! How can we help you today?");

    const s2 = await runner.resume(s1.session!, { kind: "button", id: "order_food", title: "Order food" }, actionCtx);
    expect(body(s2.outbound[0])).toBe("What would you like to order?");

    const s3 = await runner.resume(s2.session!, { kind: "list", id: "cat_burgers", title: "Burgers" }, actionCtx);
    expect(body(s3.outbound[0])).toBe("Burgers: pick an item");

    const s4 = await runner.resume(s3.session!, { kind: "list", id: "it_classic", title: "Classic Burger" }, actionCtx);
    expect(body(s4.outbound[0])).toContain("Great choice: Classic Burger");
    expect(s4.completed).toBe(true);
  });

  it("renders Arabic copy when the session language is ar", async () => {
    const runner = new FlowRunner(restaurant, actions);
    const s1 = await runner.start("main_menu", { language: "ar", context }, actionCtx);
    expect(body(s1.outbound[0])).toContain("أهلاً بك في Demo Restaurant");
  });

  it("switches language through the language flow and returns to the menu", async () => {
    const runner = new FlowRunner(restaurant, actions);
    const s1 = await runner.start("language", { language: "en", context }, actionCtx);
    const s2 = await runner.resume(s1.session!, { kind: "button", id: "ar", title: "العربية" }, actionCtx);
    expect(s2.session?.language).toBe("ar");
    expect(s2.session?.flowId).toBe("main_menu");
    expect(body(s2.outbound[0])).toContain("أهلاً");
  });

  it("hands off to a human on 'agent'", async () => {
    const runner = new FlowRunner(restaurant, actions);
    expect(runner.matchGlobalCommand({ kind: "text", text: "agent" })).toBe("talk_to_us");
    const r = await runner.start("talk_to_us", { language: "en", context }, actionCtx);
    expect(r.handoff).toBe(true);
  });
});
