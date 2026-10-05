import { type DynamicModule, Logger, Module, type Provider } from "@nestjs/common";
import { getBlueprint } from "@ordr/blueprints";
import type { ActionRegistry } from "@ordr/flow-schema";
import { CloudApiClient, LoggingSender, type MessageSender } from "@ordr/whatsapp";
import { createDemoActionRegistry } from "./actions/demo-catalog";
import { InMemoryConversationRepository, InMemoryDedupeStore, InMemorySessionStore, InMemoryTenantRepository } from "./adapters/memory";
import {
  PrismaConversationRepository,
  PrismaDedupeStore,
  PrismaService,
  PrismaSessionStore,
  PrismaTenantRepository,
} from "./adapters/prisma";
import { createRedis, RedisDedupeStore, RedisSessionStore } from "./adapters/redis";
import type { AppConfig } from "./config";
import { ConversationService } from "./conversation/conversation.service";
import { InboundQueue } from "./conversation/inbound-queue";
import { HealthController } from "./health.controller";
import type { BlueprintRegistry, ConversationRepository, DedupeStore, SessionStore, TenantContext, TenantRepository } from "./ports";
import { TOKENS } from "./tokens";
import { WebhookController } from "./webhook/webhook.controller";

export interface AppOptions {
  config: AppConfig;
  /** Pre-built adapters, mainly for tests and the simulator. Anything omitted is created from config. */
  overrides?: Partial<{
    tenants: TenantRepository;
    conversations: ConversationRepository;
    sessions: SessionStore;
    dedupe: DedupeStore;
    sender: MessageSender;
    actions: ActionRegistry;
    blueprints: BlueprintRegistry;
  }>;
}

/** Tenant used when running on in-memory storage, built from SEED_* settings. */
export function seedTenantFromConfig(config: AppConfig): TenantContext {
  return {
    tenant: {
      id: "tenant_seed",
      name: config.SEED_TENANT_NAME,
      slug: "seed",
      blueprintId: config.SEED_BLUEPRINT_ID,
      defaultLanguage: "en",
      timezone: "Asia/Dubai",
      settings: {},
    },
    channel: {
      id: "channel_seed",
      tenantId: "tenant_seed",
      provider: "meta_cloud",
      phoneNumberId: config.SEED_PHONE_NUMBER_ID,
      wabaId: config.SEED_WABA_ID,
      displayPhone: config.SEED_DISPLAY_PHONE,
      accessToken: config.SEED_ACCESS_TOKEN,
      status: "active",
    },
  };
}

@Module({})
export class AppModule {
  static register({ config, overrides = {} }: AppOptions): DynamicModule {
    const logger = new Logger("AppModule");
    const providers: Provider[] = [
      { provide: TOKENS.Config, useValue: config },
      { provide: TOKENS.ActionRegistry, useValue: overrides.actions ?? createDemoActionRegistry() },
      { provide: TOKENS.BlueprintRegistry, useValue: overrides.blueprints ?? { get: getBlueprint } },
      {
        provide: TOKENS.MessageSender,
        useValue:
          overrides.sender ??
          (config.WHATSAPP_SENDER === "log" ? new LoggingSender() : new CloudApiClient({ graphVersion: config.META_GRAPH_VERSION })),
      },
      InboundQueue,
      ConversationService,
    ];

    if (config.storage === "memory") {
      logger.log("storage=memory: tenants, conversations, sessions and dedupe live in process");
      providers.push(
        { provide: TOKENS.TenantRepository, useValue: overrides.tenants ?? new InMemoryTenantRepository([seedTenantFromConfig(config)]) },
        { provide: TOKENS.ConversationRepository, useValue: overrides.conversations ?? new InMemoryConversationRepository() },
        { provide: TOKENS.SessionStore, useValue: overrides.sessions ?? new InMemorySessionStore() },
        { provide: TOKENS.DedupeStore, useValue: overrides.dedupe ?? new InMemoryDedupeStore() },
      );
    } else {
      providers.push(PrismaService);
      providers.push(
        overrides.tenants
          ? { provide: TOKENS.TenantRepository, useValue: overrides.tenants }
          : { provide: TOKENS.TenantRepository, useFactory: (p: PrismaService) => new PrismaTenantRepository(p), inject: [PrismaService] },
        overrides.conversations
          ? { provide: TOKENS.ConversationRepository, useValue: overrides.conversations }
          : { provide: TOKENS.ConversationRepository, useFactory: (p: PrismaService) => new PrismaConversationRepository(p), inject: [PrismaService] },
      );
      if (config.REDIS_URL) {
        logger.log("storage=prisma with Redis for sessions and dedupe");
        const redis = createRedis(config.REDIS_URL);
        providers.push(
          { provide: TOKENS.SessionStore, useValue: overrides.sessions ?? new RedisSessionStore(redis) },
          { provide: TOKENS.DedupeStore, useValue: overrides.dedupe ?? new RedisDedupeStore(redis) },
        );
      } else {
        logger.log("storage=prisma without Redis: sessions and dedupe in Postgres");
        providers.push(
          overrides.sessions
            ? { provide: TOKENS.SessionStore, useValue: overrides.sessions }
            : { provide: TOKENS.SessionStore, useFactory: (p: PrismaService) => new PrismaSessionStore(p), inject: [PrismaService] },
          overrides.dedupe
            ? { provide: TOKENS.DedupeStore, useValue: overrides.dedupe }
            : { provide: TOKENS.DedupeStore, useFactory: (p: PrismaService) => new PrismaDedupeStore(p), inject: [PrismaService] },
        );
      }
    }

    return {
      module: AppModule,
      controllers: [WebhookController, HealthController],
      providers,
      exports: [ConversationService, InboundQueue],
    };
  }
}
