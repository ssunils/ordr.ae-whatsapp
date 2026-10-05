import { describe, expect, it } from "vitest";
import { FlowRunner, MapActionRegistry } from "./runner";
import { parseBlueprint } from "./schema";

const blueprint = parseBlueprint({
  id: "test",
  version: 1,
  name: "Test",
  defaultLanguage: "en",
  languages: ["en", "ar"],
  offeringType: "product",
  fulfillmentTypes: ["pickup"],
  orderStates: { initial: "placed", states: ["placed", "done"], transitions: [{ from: "placed", to: "done", on: "complete" }] },
  entryFlow: "main",
  globalCommands: [{ keywords: ["menu", "hi"], flow: "main" }],
  flows: [
    {
      id: "main",
      entry: "welcome",
      nodes: [
        { id: "welcome", type: "message", text: { en: "Welcome {{customer.name}}", ar: "أهلاً {{customer.name}}" }, next: "choice" },
        {
          id: "choice",
          type: "question",
          var: "choice",
          prompt: "What next?",
          maxRetries: 1,
          input: {
            kind: "buttons",
            options: [
              { id: "order", title: "Order", next: "to_order" },
              { id: "bye", title: "Bye", next: "end" },
            ],
          },
        },
        { id: "to_order", type: "goto_flow", flow: "order" },
        { id: "end", type: "end", text: "Goodbye" },
      ],
    },
    {
      id: "order",
      entry: "load",
      nodes: [
        { id: "load", type: "action", action: "catalog.categories", saveAs: "categories", next: "pick" },
        {
          id: "pick",
          type: "question",
          var: "category",
          prompt: "Pick a category",
          input: { kind: "list", button: "Categories", rowsFrom: "categories", onEmpty: "empty" },
          next: "confirm",
        },
        { id: "confirm", type: "message", text: "You picked {{category.title}}", next: "route" },
        {
          id: "route",
          type: "branch",
          cases: [{ var: "category.id", eq: "vip", next: "agent" }],
          default: "done",
        },
        { id: "agent", type: "handoff", text: "Connecting you" },
        { id: "empty", type: "end", text: "Nothing available" },
        { id: "done", type: "end" },
      ],
    },
  ],
});

function makeRunner(categories: Array<{ id: string; title: string }> = [{ id: "burgers", title: "Burgers" }, { id: "vip", title: "VIP" }]) {
  const actions = new MapActionRegistry().register("catalog.categories", async () => categories);
  return new FlowRunner(blueprint, actions);
}

const actionCtx = { tenantId: "t1", customer: { waId: "971500000001", name: "Sara" } };

describe("FlowRunner", () => {
  it("runs until the first question and renders interpolated copy", async () => {
    const r = await makeRunner().start("main", { language: "ar", context: { customer: { name: "Sara" } } }, actionCtx);
    expect(r.outbound).toHaveLength(2);
    expect(r.outbound[0]).toMatchObject({ type: "text", text: { body: "أهلاً Sara" } });
    expect(r.outbound[1]).toMatchObject({ type: "interactive", interactive: { type: "button" } });
    expect(r.session?.awaiting).toBe(true);
    expect(r.session?.nodeId).toBe("choice");
  });

  it("follows option.next into another flow, runs actions and dynamic lists", async () => {
    const runner = makeRunner();
    const first = await runner.start("main", { language: "en" }, actionCtx);
    const second = await runner.resume(first.session!, { kind: "button", id: "order", title: "Order" }, actionCtx);
    expect(second.session?.flowId).toBe("order");
    expect(second.session?.nodeId).toBe("pick");
    const listMsg = second.outbound[0];
    expect(listMsg).toMatchObject({ type: "interactive", interactive: { type: "list" } });
    if (listMsg?.type === "interactive" && listMsg.interactive.type === "list") {
      expect(listMsg.interactive.action.sections[0]?.rows.map((r) => r.id)).toEqual(["burgers", "vip"]);
    }
    const third = await runner.resume(second.session!, { kind: "list", id: "burgers", title: "Burgers" }, actionCtx);
    expect(third.outbound[0]).toMatchObject({ type: "text", text: { body: "You picked Burgers" } });
    expect(third.completed).toBe(true);
    expect(third.session).toBeNull();
  });

  it("accepts typed numbers and titles in place of taps", async () => {
    const runner = makeRunner();
    const first = await runner.start("main", { language: "en" }, actionCtx);
    const byNumber = await runner.resume(first.session!, { kind: "text", text: "2" }, actionCtx);
    expect(byNumber.outbound[0]).toMatchObject({ text: { body: "Goodbye" } });

    const again = await runner.start("main", { language: "en" }, actionCtx);
    const byTitle = await runner.resume(again.session!, { kind: "text", text: "bye" }, actionCtx);
    expect(byTitle.completed).toBe(true);
  });

  it("re-asks on invalid input and gives up after maxRetries", async () => {
    const runner = makeRunner();
    const first = await runner.start("main", { language: "en" }, actionCtx);
    const bad1 = await runner.resume(first.session!, { kind: "text", text: "nonsense" }, actionCtx);
    expect(bad1.session?.retries).toBe(1);
    expect(bad1.outbound).toHaveLength(2);
    const bad2 = await runner.resume(bad1.session!, { kind: "text", text: "still nonsense" }, actionCtx);
    expect(bad2.session).toBeNull();
    expect(bad2.completed).toBe(true);
  });

  it("branches to handoff", async () => {
    const runner = makeRunner();
    const s1 = await runner.start("order", { language: "en" }, actionCtx);
    const s2 = await runner.resume(s1.session!, { kind: "list", id: "vip", title: "VIP" }, actionCtx);
    expect(s2.handoff).toBe(true);
    expect(s2.outbound.map((m) => (m.type === "text" ? m.text.body : m.type))).toEqual(["You picked VIP", "Connecting you"]);
  });

  it("takes onEmpty when a dynamic list has no rows", async () => {
    const runner = makeRunner([]);
    const r = await runner.start("order", { language: "en" }, actionCtx);
    expect(r.completed).toBe(true);
    expect(r.outbound[0]).toMatchObject({ text: { body: "Nothing available" } });
  });

  it("matches global commands only on text", () => {
    const runner = makeRunner();
    expect(runner.matchGlobalCommand({ kind: "text", text: " Menu " })).toBe("main");
    expect(runner.matchGlobalCommand({ kind: "text", text: "something" })).toBeUndefined();
    expect(runner.matchGlobalCommand({ kind: "button", id: "menu", title: "menu" })).toBeUndefined();
  });

  it("rejects blueprints with dangling references", () => {
    expect(() =>
      parseBlueprint({
        ...blueprint,
        flows: [{ id: "main", entry: "missing", nodes: [{ id: "a", type: "end" }] }],
      }),
    ).toThrow(/entry references unknown node "missing"/);
  });
});
