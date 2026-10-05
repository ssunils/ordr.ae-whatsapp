import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  META_APP_SECRET: z.string().min(1),
  META_VERIFY_TOKEN: z.string().min(1),
  META_GRAPH_VERSION: z.string().default("v23.0"),
  WHATSAPP_SENDER: z.enum(["meta", "log"]).default("meta"),
  /** memory: everything in process (dev and tests). prisma: Postgres, plus Redis when REDIS_URL is set. */
  STORAGE: z.enum(["memory", "prisma"]).optional(),
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
  SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(24 * 60 * 60),
  DEDUPE_TTL_SECONDS: z.coerce.number().int().positive().default(7 * 24 * 60 * 60),
  SEED_TENANT_NAME: z.string().default("Demo Restaurant"),
  SEED_BLUEPRINT_ID: z.string().default("restaurant"),
  SEED_PHONE_NUMBER_ID: z.string().default("000000000000000"),
  SEED_WABA_ID: z.string().default("000000000000000"),
  SEED_DISPLAY_PHONE: z.string().default("+971500000000"),
  SEED_ACCESS_TOKEN: z.string().default("replace-me"),
});

export type AppConfig = z.infer<typeof EnvSchema> & { storage: "memory" | "prisma" };

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.parse(env);
  const storage = parsed.STORAGE ?? (parsed.DATABASE_URL ? "prisma" : "memory");
  return { ...parsed, storage };
}
