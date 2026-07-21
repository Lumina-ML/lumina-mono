import {
  type DomainEvent,
  type KnownDomainEvent,
  domainEventSchema,
} from "../../core/events/domain-event.js";
import type { EventBus, EventHandler } from "../../core/bus/event-bus.js";

export class MemoryEventBus implements EventBus {
  private readonly handlers = new Map<string, Array<EventHandler<DomainEvent>>>();

  async publish(event: DomainEvent): Promise<void> {
    // Validate at the in-process boundary so a typo at a publish site
    // ("ArtifactUpload" vs "ArtifactUploaded") fails fast instead of
    // silently dispatching to zero subscribers.
    const parseResult = domainEventSchema.safeParse(event);
    if (!parseResult.success) {
      console.error(
        `Refusing to publish malformed event ${event.type}`,
        parseResult.error.issues,
      );
      return;
    }
    const validated = parseResult.data;
    const handlers = this.handlers.get(validated.type) ?? [];
    for (const handler of handlers) {
      try {
        await handler(validated);
      } catch (err) {
        // Event bus must not break the caller; log and continue.
        console.error(`Event handler failed for ${validated.type}`, err);
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
