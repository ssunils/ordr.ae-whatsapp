import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Handles the GET verification handshake Meta performs when a webhook URL is registered.
 * Returns the challenge to echo back, or null when the token does not match.
 */
export function verifyWebhookChallenge(
  query: Record<string, string | string[] | undefined>,
  verifyToken: string,
): string | null {
  const mode = query["hub.mode"];
  const token = query["hub.verify_token"];
  const challenge = query["hub.challenge"];
  if (mode === "subscribe" && token === verifyToken && typeof challenge === "string") return challenge;
  return null;
}

/** Validates the X-Hub-Signature-256 header against the raw request body. */
export function verifySignature(rawBody: Buffer | string, signatureHeader: string | undefined, appSecret: string): boolean {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const received = signatureHeader.slice("sha256=".length);
  if (expected.length !== received.length) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received, "hex"));
}

export function signBody(rawBody: Buffer | string, appSecret: string): string {
  return "sha256=" + createHmac("sha256", appSecret).update(rawBody).digest("hex");
}
