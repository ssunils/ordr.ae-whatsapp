import { describe, expect, it } from "vitest";
import { buttonReplyWebhook, listReplyWebhook, locationWebhook, statusWebhook, textMessageWebhook } from "./fixtures";
import { parseWebhook } from "./inbound";

describe("parseWebhook", () => {
  it("normalizes a text message", () => {
    const [ev] = parseWebhook(textMessageWebhook("hello", { from: "971501111111", profileName: "Sara" }));
    expect(ev).toMatchObject({
      type: "message",
      from: "971501111111",
      profileName: "Sara",
      content: { kind: "text", text: "hello" },
    });
  });

  it("normalizes interactive replies", () => {
    const [b] = parseWebhook(buttonReplyWebhook("order_food", "Order food"));
    expect(b?.type === "message" && b.content).toEqual({ kind: "button", id: "order_food", title: "Order food" });
    const [l] = parseWebhook(listReplyWebhook("cat_1", "Burgers"));
    expect(l?.type === "message" && l.content).toMatchObject({ kind: "list", id: "cat_1", title: "Burgers" });
  });

  it("normalizes a location", () => {
    const [ev] = parseWebhook(locationWebhook(25.2, 55.27));
    expect(ev?.type === "message" && ev.content).toEqual({ kind: "location", latitude: 25.2, longitude: 55.27 });
  });

  it("normalizes delivery statuses", () => {
    const [ev] = parseWebhook(statusWebhook("wamid.1", "delivered"));
    expect(ev).toMatchObject({ type: "status", messageId: "wamid.1", status: "delivered" });
  });

  it("ignores payloads for other objects", () => {
    expect(parseWebhook({ object: "page" as never, entry: [] })).toEqual([]);
  });
});
