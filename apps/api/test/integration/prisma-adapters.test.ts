import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaConversationRepository, PrismaDedupeStore, PrismaSessionStore, PrismaTenantRepository } from "../../src/adapters/prisma";

const prisma = new PrismaClient();
const suffix = Date.now().toString(36);
let tenantId = "";
let channelId = "";
const phoneNumberId = `pn_${suffix}`;

beforeAll(async () => {
  const tenant = await prisma.tenant.create({ data: { name: "IT Tenant", slug: `it-${suffix}`, blueprintId: "restaurant" } });
  tenantId = tenant.id;
  const channel = await prisma.channel.create({
    data: { tenantId, phoneNumberId, wabaId: "w", displayPhone: "+9715", accessToken: "tok" },
  });
  channelId = channel.id;
});

afterAll(async () => {
  await prisma.message.deleteMany({ where: { tenantId } });
  await prisma.conversation.deleteMany({ where: { tenantId } });
  await prisma.customer.deleteMany({ where: { tenantId } });
  await prisma.session.deleteMany({ where: { tenantId } });
  await prisma.channel.deleteMany({ where: { tenantId } });
  await prisma.tenant.delete({ where: { id: tenantId } });
  await prisma.processedWebhook.deleteMany({ where: { key: { startsWith: `it:${suffix}` } } });
  await prisma.$disconnect();
});

describe("Prisma adapters", () => {
  it("resolves a tenant by phone number id and caches misses", async () => {
    const repo = new PrismaTenantRepository(prisma, 1000);
    const ctx = await repo.findByPhoneNumberId(phoneNumberId);
    expect(ctx?.tenant.id).toBe(tenantId);
    expect(ctx?.channel.accessToken).toBe("tok");
    expect(await repo.findByPhoneNumberId("nope")).toBeNull();
  });

  it("upserts customers, reuses open conversations and records messages", async () => {
    const repo = new PrismaConversationRepository(prisma);
    const c1 = await repo.upsertCustomer(tenantId, "971500000777", "Sara");
    const c2 = await repo.upsertCustomer(tenantId, "971500000777");
    expect(c2.id).toBe(c1.id);
    expect(c2.name).toBe("Sara");

    const conv1 = await repo.getOrCreateOpenConversation(tenantId, c1.id, channelId);
    const conv2 = await repo.getOrCreateOpenConversation(tenantId, c1.id, channelId);
    expect(conv2.id).toBe(conv1.id);

    await repo.recordMessage({
      tenantId,
      conversationId: conv1.id,
      direction: "out",
      providerMessageId: `wamid.it.${suffix}`,
      kind: "text",
      payload: { type: "text", text: { body: "hi" } },
      createdAt: new Date(),
    });
    await repo.updateMessageStatus(`wamid.it.${suffix}`, "delivered");
    const stored = await prisma.message.findUnique({ where: { providerMessageId: `wamid.it.${suffix}` } });
    expect(stored?.status).toBe("delivered");

    await repo.setConversationStatus(conv1.id, "closed");
    const conv3 = await repo.getOrCreateOpenConversation(tenantId, c1.id, channelId);
    expect(conv3.id).not.toBe(conv1.id);

    await repo.setCustomerLanguage(c1.id, "ar");
    expect((await repo.upsertCustomer(tenantId, "971500000777")).language).toBe("ar");
  });

  it("stores sessions with expiry", async () => {
    const store = new PrismaSessionStore(prisma);
    const session = { flowId: "main", nodeId: "q", awaiting: true, retries: 0, language: "en", context: { a: 1 }, updatedAt: new Date().toISOString() };
    await store.set(tenantId, "971500000778", session, 60);
    expect(await store.get(tenantId, "971500000778")).toEqual(session);
    await store.set(tenantId, "971500000778", session, -1);
    expect(await store.get(tenantId, "971500000778")).toBeNull();
  });

  it("claims a dedupe key exactly once", async () => {
    const store = new PrismaDedupeStore(prisma);
    const key = `it:${suffix}:1`;
    expect(await store.claim(key, 60)).toBe(true);
    expect(await store.claim(key, 60)).toBe(false);
  });
});
