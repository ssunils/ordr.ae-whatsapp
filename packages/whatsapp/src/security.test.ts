import { describe, expect, it } from "vitest";
import { signBody, verifySignature, verifyWebhookChallenge } from "./security";

describe("webhook security", () => {
  it("echoes the challenge for a valid handshake", () => {
    const q = { "hub.mode": "subscribe", "hub.verify_token": "tok", "hub.challenge": "123" };
    expect(verifyWebhookChallenge(q, "tok")).toBe("123");
    expect(verifyWebhookChallenge(q, "other")).toBeNull();
  });

  it("accepts a correctly signed body and rejects a tampered one", () => {
    const body = JSON.stringify({ a: 1 });
    const sig = signBody(body, "secret");
    expect(verifySignature(body, sig, "secret")).toBe(true);
    expect(verifySignature(body + " ", sig, "secret")).toBe(false);
    expect(verifySignature(body, sig, "wrong")).toBe(false);
    expect(verifySignature(body, undefined, "secret")).toBe(false);
  });
});
