import { fixtures, signBody } from "@ordr/whatsapp";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHarness, type Harness, TEST_SECRET, TEST_VERIFY_TOKEN } from "./helpers";

describe("WhatsApp webhook endpoint", () => {
  let h: Harness;
  beforeEach(async () => {
    h = await createHarness();
  });
  afterEach(async () => {
    await h.app.close();
  });

  it("completes Meta's verification handshake", async () => {
    const res = await request(h.app.getHttpServer())
      .get("/webhooks/whatsapp")
      .query({ "hub.mode": "subscribe", "hub.verify_token": TEST_VERIFY_TOKEN, "hub.challenge": "42" });
    expect(res.status).toBe(200);
    expect(res.text).toBe("42");
  });

  it("rejects a wrong verify token", async () => {
    const res = await request(h.app.getHttpServer())
      .get("/webhooks/whatsapp")
      .query({ "hub.mode": "subscribe", "hub.verify_token": "nope", "hub.challenge": "42" });
    expect(res.status).toBe(403);
  });

  it("rejects unsigned and badly signed posts", async () => {
    const body = JSON.stringify(fixtures.textMessageWebhook("hi", h.base));
    const unsigned = await request(h.app.getHttpServer()).post("/webhooks/whatsapp").set("content-type", "application/json").send(body);
    expect(unsigned.status).toBe(401);
    const bad = await request(h.app.getHttpServer())
      .post("/webhooks/whatsapp")
      .set("content-type", "application/json")
      .set("x-hub-signature-256", signBody(body, "wrong"))
      .send(body);
    expect(bad.status).toBe(401);
    expect(h.sender.sent).toHaveLength(0);
  });

  it("acknowledges a signed post immediately and replies asynchronously", async () => {
    const body = JSON.stringify(fixtures.textMessageWebhook("hi", h.base));
    const res = await request(h.app.getHttpServer())
      .post("/webhooks/whatsapp")
      .set("content-type", "application/json")
      .set("x-hub-signature-256", signBody(body, TEST_SECRET))
      .send(body);
    expect(res.status).toBe(200);
    await h.queue.whenIdle();
    expect(h.sender.to("971500000001")).toHaveLength(1);
  });

  it("serializes messages from the same customer in order", async () => {
    const first = JSON.stringify(fixtures.textMessageWebhook("hi", h.base));
    const second = JSON.stringify(fixtures.buttonReplyWebhook("order_food", "Order food", h.base));
    await Promise.all(
      [first, second].map((b) =>
        request(h.app.getHttpServer())
          .post("/webhooks/whatsapp")
          .set("content-type", "application/json")
          .set("x-hub-signature-256", signBody(b, TEST_SECRET))
          .send(b),
      ),
    );
    await h.queue.whenIdle();
    const kinds = h.sender.to("971500000001").map((m) => (m.type === "interactive" ? m.interactive.type : m.type));
    expect(kinds).toEqual(["button", "list"]);
  });

  it("exposes a health endpoint", async () => {
    const res = await request(h.app.getHttpServer()).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});
