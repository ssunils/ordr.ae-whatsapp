import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const env = process.env;
  const name = env.SEED_TENANT_NAME ?? "Demo Restaurant";
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const tenant = await prisma.tenant.upsert({
    where: { slug },
    update: { name, blueprintId: env.SEED_BLUEPRINT_ID ?? "restaurant" },
    create: { name, slug, blueprintId: env.SEED_BLUEPRINT_ID ?? "restaurant" },
  });
  const phoneNumberId = env.SEED_PHONE_NUMBER_ID ?? "000000000000000";
  await prisma.channel.upsert({
    where: { phoneNumberId },
    update: { accessToken: env.SEED_ACCESS_TOKEN ?? "replace-me" },
    create: {
      tenantId: tenant.id,
      phoneNumberId,
      wabaId: env.SEED_WABA_ID ?? "000000000000000",
      displayPhone: env.SEED_DISPLAY_PHONE ?? "+971500000000",
      accessToken: env.SEED_ACCESS_TOKEN ?? "replace-me",
    },
  });
  console.log(`Seeded tenant "${tenant.name}" (${tenant.id}) with channel ${phoneNumberId}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
