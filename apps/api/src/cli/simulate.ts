import "reflect-metadata";
import { createInterface } from "node:readline";
import { resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import { fixtures, type MessageSender, type OutboundMessage, parseWebhook } from "@ordr/whatsapp";
import { config as loadEnv } from "dotenv";
import { AppModule } from "../app.module";
import { loadConfig } from "../config";
import { ConversationService } from "../conversation/conversation.service";

/**
 * Chat with the bot in the terminal without a WhatsApp number. Every line you type becomes a
 * webhook payload; tapping a button is simulated by typing its number.
 */

loadEnv({ path: [resolve(__dirname, "../../../../.env"), resolve(process.cwd(), ".env")] });

function render(m: OutboundMessage): string {
  switch (m.type) {
    case "text":
      return m.text.body;
    case "interactive": {
      const i = m.interactive;
      if (i.type === "button") {
        const opts = i.action.buttons.map((b, n) => `  [${n + 1}] ${b.reply.title}`).join("\n");
        return `${i.body.text}\n${opts}`;
      }
      if (i.type === "list") {
        let n = 0;
        const rows = i.action.sections
          .map((s) => (s.title ? `  -- ${s.title}\n` : "") + s.rows.map((r) => `  [${++n}] ${r.title}${r.description ? `  (${r.description})` : ""}`).join("\n"))
          .join("\n");
        return `${i.body.text}\n${rows}`;
      }
      return `${i.body.text}\n  (share your location)`;
    }
    case "template":
      return `[template ${m.template.name}]`;
    case "image":
      return `[image] ${m.image.caption ?? ""}`;
  }
}

async function main(): Promise<void> {
  const config = loadConfig({
    META_APP_SECRET: "simulator",
    META_VERIFY_TOKEN: "simulator",
    STORAGE: "memory",
    ...process.env,
    WHATSAPP_SENDER: "log",
  });
  config.storage = "memory";

  const sender: MessageSender = {
    async send(_target, message) {
      process.stdout.write(`\nbot> ${render(message)}\n`);
      return { providerMessageId: `wamid.sim.${Date.now()}` };
    },
  };

  const app = await NestFactory.createApplicationContext(AppModule.register({ config, overrides: { sender } }), { logger: ["error", "warn"] });
  const service = app.get(ConversationService);
  const base = { phoneNumberId: config.SEED_PHONE_NUMBER_ID, from: process.env.SIM_FROM ?? "971500000001", profileName: process.env.SIM_NAME ?? "Sim User" };

  process.stdout.write(`Simulating tenant "${config.SEED_TENANT_NAME}" (${config.SEED_BLUEPRINT_ID}). Type a message, Ctrl+C to quit.\n\n`);
  const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: "you> " });
  // Lines are processed strictly in order, as the InboundQueue does for real webhooks.
  let chain = Promise.resolve();
  rl.prompt();
  rl.on("line", (line) => {
    const textLine = line.trim();
    chain = chain.then(async () => {
      if (textLine) {
        const events = parseWebhook(fixtures.textMessageWebhook(textLine, base));
        for (const ev of events) await service.handleEvent(ev);
      }
      rl.prompt();
    });
  });
  rl.on("close", () => {
    void chain.then(async () => {
      await app.close();
      process.exit(0);
    });
  });
}

void main();
