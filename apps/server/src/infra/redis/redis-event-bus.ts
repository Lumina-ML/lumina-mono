import { Redis } from "ioredis";
import {
  type DomainEvent,
  type KnownDomainEvent,
  domainEventSchema,
} from "../../core/events/domain-event.js";
import type { EventBus, EventHandler } from "../../core/bus/event-bus.js";

export interface RedisEventBusConfig {
  redisUrl: string;
  channelPrefix?: string;
}

export class RedisEventBus implements EventBus {
  private readonly publisher: Redis;
  private readonly subscriber: Redis;
  private readonly channelPrefix: string;
  private readonly handlers = new Map<string, Array<EventHandler<DomainEvent>>>();

  constructor(config: RedisEventBusConfig) {
    this.publisher = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    this.subscriber = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    this.channelPrefix = config.channelPrefix ? `${config.channelPrefix}:` : "";

    this.subscriber.on("message", async (channel, message) => {
      const eventType = channel.slice(this.channelPrefix.length);
      try {
        // Zod parse (a) coerces `occurredAt` from the JSON string back to
        // a Date so subscribers' date math doesn't silently NaN, and
        // (b) rejects malformed payloads (missing fields, wrong types,
        // unknown event type) instead of dispatching `DomainEvent`-typed
        // garbage to subscribers.
        const parseResult = domainEventSchema.safeParse(JSON.parse(message));
        if (!parseResult.success) {
          console.error(
            `Failed to validate Redis event on ${channel}`,
            parseResult.error.issues,
          );
          return;
        }
        await this.dispatch(eventType, parseResult.data);
      } catch (err) {
        console.error(`Failed to handle Redis event on ${channel}`, err);
      }
    });
  }

  async publish(event: DomainEvent): Promise<void> {
    // Publish to Redis; the local subscriber will dispatch to handlers,
    // ensuring consistent delivery whether the event originated locally or remotely.
    await this.publisher.publish(this.channel(event.type), JSON.stringify(event));
  }

  subscribe<T extends KnownDomainEvent["type"]>(
    eventType: T,
    handler: EventHandler<Extract<KnownDomainEvent, { type: T }>>,
  ): void {
    const existing = (this.handlers.get(eventType) ?? []) as Array<EventHandler<DomainEvent>>;
    existing.push(handler as EventHandler<DomainEvent>);
    this.handlers.set(eventType, existing);

    this.subscriber.subscribe(this.channel(eventType)).catch((err) => {
      console.error(`Failed to subscribe to ${eventType}`, err);
    });
  }

  async close(): Promise<void> {
    await this.subscriber.quit();
    await this.publisher.quit();
  }

  private channel(eventType: string): string {
    return `${this.channelPrefix}${eventType}`;
  }

  private async dispatch(eventType: string, event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(eventType) ?? [];
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (err) {
        console.error(`Remote event handler failed for ${eventType}`, err);
      }
    }
  }
}
