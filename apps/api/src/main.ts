import "reflect-metadata";
import { resolve } from "node:path";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { config as loadEnv } from "dotenv";
import { AppModule } from "./app.module";
import { loadConfig } from "./config";
import { InboundQueue } from "./conversation/inbound-queue";

loadEnv({ path: [resolve(__dirname, "../../../.env"), resolve(process.cwd(), ".env")] });

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const app = await NestFactory.create<NestExpressApplication>(AppModule.register({ config }), { rawBody: true });
  app.enableShutdownHooks();

  const queue = app.get(InboundQueue);
  const shutdown = async (signal: string) => {
    Logger.log(`${signal} received, draining inbound queue`, "Bootstrap");
    await queue.whenIdle();
    await app.close();
    process.exit(0);
  };
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));

  await app.listen(config.PORT);
  Logger.log(`API listening on http://localhost:${config.PORT} (storage=${config.storage}, sender=${config.WHATSAPP_SENDER})`, "Bootstrap");
}

void bootstrap();
