import type { SessionState } from "@ordr/flow-schema";
import Redis from "ioredis";
import type { DedupeStore, SessionStore } from "../ports";

export function createRedis(url: string): Redis {
  return new Redis(url, { maxRetriesPerRequest: 3, lazyConnect: false });
}

export class RedisSessionStore implements SessionStore {
  constructor(private readonly redis: Redis) {}

  private key(tenantId: string, waId: string): string {
    return `session:${tenantId}:${waId}`;
  }

  async get(tenantId: string, waId: string): Promise<SessionState | null> {
    const raw = await this.redis.get(this.key(tenantId, waId));
    return raw ? (JSON.parse(raw) as SessionState) : null;
  }

  async set(tenantId: string, waId: string, session: SessionState, ttlSeconds: number): Promise<void> {
    await this.redis.set(this.key(tenantId, waId), JSON.stringify(session), "EX", ttlSeconds);
  }

  async delete(tenantId: string, waId: string): Promise<void> {
    await this.redis.del(this.key(tenantId, waId));
  }
}

export class RedisDedupeStore implements DedupeStore {
  constructor(private readonly redis: Redis) {}

  async claim(key: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.redis.set(`dedupe:${key}`, "1", "EX", ttlSeconds, "NX");
    return result === "OK";
  }
}
