import type { DomainEvent, KnownDomainEvent } from "../../core/events/domain-event.js";
import type { EventBus, EventHandler } from "../../core/bus/event-bus.js";

export class MemoryEventBus implements EventBus {
  private readonly handlers = new Map<string, Array<EventHandler<DomainEvent>>>();

  async publish(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.type) ?? [];
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (err) {
        // Event bus must not break the caller; log and continue.
        console.error(`Event handler failed for ${event.type}`, err);
      }
    }
  }

  subscribe<T extends KnownDomainEvent["type"]>(
    eventType: T,
    handler: EventHandler<Extract<KnownDomainEvent, { type: T }>>,
  ): void {
    const existing = (this.handlers.get(eventType) ?? []) as Array<EventHandler<DomainEvent>>;
    existing.push(handler as EventHandler<DomainEvent>);
    this.handlers.set(eventType, existing);
  }
}
