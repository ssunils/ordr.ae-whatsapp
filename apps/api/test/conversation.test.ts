import { fixtures, type OutboundMessage, parseWebhook } from "@ordr/whatsapp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "./helpers";

function bodyOf(m: OutboundMessage | undefined): string {
  if (!m) return "";
  if (m.type === "text") return m.text.body;
  if (m.type === "interactive" && "body" in m.interactive) return m.interactive.body.text;
  return m.type;
}

describe("ConversationService", () => {
  let h: Harness;
  beforeEach(async () => {
    h = await createHarness();
  });
  afterEach(async () => {
    await h.app.close();
  });

  async function send(payload: ReturnType<typeof fixtures.textMessageWebhook>) {
    for (const ev of parseWebhook(payload)) await h.service.handleEvent(ev);
  }

  it("greets a new customer with the main menu and stores the session", async () => {
    await send(fixtures.textMessageWebhook("hi", h.base));
    const msgs = h.sender.to("971500000001");
    expect(msgs).toHaveLength(1);
    expect(bodyOf(msgs[0])).toBe("Welcome to Demo Restaurant! How can we help you today?");
    const session = await h.sessions.get("tenant_seed", "971500000001");
    expect(session?.awaiting).toBe(true);
    expect(h.conversations.messages.filter((m) => m.direction === "in")).toHaveLength(1);
    expect(h.conversations.messages.filter((m) => m.direction === "out")).toHaveLength(1);
  });

  it("walks the ordering flow across turns", async () => {
    await send(fixtures.textMessageWebhook("hi", h.base));
    await send(fixtures.buttonReplyWebhook("order_food", "Order food", h.base));
    await send(fixtures.listReplyWebhook("cat_burgers", "Burgers", h.base));
    await send(fixtures.listReplyWebhook("it_classic_burger", "Classic Burger", h.base));
    const bodies = h.sender.to("971500000001").map(bodyOf);
    expect(bodies[1]).toBe("What would you like to order?");
    expect(bodies[2]).toBe("Burgers: pick an item");
    expect(bodies[3]).toContain("Great choice: Classic Burger");
    expect(await h.sessions.get("tenant_seed", "971500000001")).toBeNull();
  });

  it("drops duplicate webhook deliveries", async () => {
    const payload = fixtures.textMessageWebhook("hi", { ...h.base, messageId: "wamid.dup" });
    await send(payload);
    await send(payload);
    expect(h.sender.to("971500000001")).toHaveLength(1);
  });

  it("ignores numbers that belong to no tenant", async () => {
    await send(fixtures.textMessageWebhook("hi", { ...h.base, phoneNumberId: "999" }));
    expect(h.sender.sent).toHaveLength(0);
  });

  it("detects Arabic on first contact and remembers it", async () => {
    await send(fixtures.textMessageWebhook("مرحبا", h.base));
    expect(bodyOf(h.sender.to("971500000001")[0])).toContain("أهلاً بك في Demo Restaurant");
    const customer = await h.conversations.upsertCustomer("tenant_seed", "971500000001");
    expect(customer.language).toBe("ar");
  });

  it("goes quiet after handoff and resumes on 'menu'", async () => {
    await send(fixtures.textMessageWebhook("agent", h.base));
    expect(bodyOf(h.sender.to("971500000001")[0])).toBe("One of our team will reply here shortly.");
    const conv = [...h.conversations.conversations.values()][0];
    expect(conv?.status).toBe("human");

    await send(fixtures.textMessageWebhook("is anyone there?", h.base));
    expect(h.sender.to("971500000001")).toHaveLength(1);

    await send(fixtures.textMessageWebhook("menu", h.base));
    expect(h.sender.to("971500000001")).toHaveLength(2);
    expect(conv?.status).toBe("bot");
  });

  it("restarts from the entry flow when a session has ended", async () => {
    await send(fixtures.textMessageWebhook("agent", h.base));
    await send(fixtures.textMessageWebhook("menu", h.base));
    await send(fixtures.textMessageWebhook("random words", h.base));
    const bodies = h.sender.to("971500000001").map(bodyOf);
    expect(bodies[2]).toBe("Please tap one of the buttons, or type 1, 2 or 3.");
  });

  it("records delivery statuses", async () => {
    await send(fixtures.textMessageWebhook("hi", h.base));
    const outId = h.sender.sent[0]!.providerMessageId;
    await send(fixtures.statusWebhook(outId, "delivered", h.base));
    expect(h.conversations.statuses.get(outId)).toBe("delivered");
  });
});
