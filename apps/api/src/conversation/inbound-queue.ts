import { Injectable, Logger } from "@nestjs/common";

/**
 * Serializes work per key (one customer on one business number) so two quick messages from the
 * same person never race on session state, while different customers run in parallel.
 * In-process for now; a BullMQ queue takes this role once there is more than one API instance.
 */
@Injectable()
export class InboundQueue {
  private readonly logger = new Logger(InboundQueue.name);
  private readonly chains = new Map<string, Promise<void>>();
  private pending = 0;
  private idleResolvers: Array<() => void> = [];

  enqueue(key: string, work: () => Promise<void>): void {
    this.pending += 1;
    const prev = this.chains.get(key) ?? Promise.resolve();
    const next = prev
      .then(work)
      .catch((err) => this.logger.error(`inbound work failed for ${key}: ${err instanceof Error ? err.stack : String(err)}`))
      .finally(() => {
        this.pending -= 1;
        if (this.chains.get(key) === next) this.chains.delete(key);
        if (this.pending === 0) {
          for (const r of this.idleResolvers) r();
          this.idleResolvers = [];
        }
      });
    this.chains.set(key, next);
  }

  /** Resolves once every queued item has finished. Used by tests and graceful shutdown. */
  whenIdle(): Promise<void> {
    if (this.pending === 0) return Promise.resolve();
    return new Promise((resolve) => this.idleResolvers.push(resolve));
  }
}
