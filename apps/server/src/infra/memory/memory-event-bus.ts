import {
  type DomainEvent,
  type KnownDomainEvent,
  domainEventSchema,
} from "../../core/events/domain-event.js";
import type { EventBus, EventHandler } from "../../core/bus/event-bus.js";
import type { FastifyBaseLogger } from "fastify";

export class MemoryEventBus implements EventBus {
  private readonly handlers = new Map<string, Array<EventHandler<DomainEvent>>>();

  constructor(private readonly logger?: FastifyBaseLogger) {}

  async publish(event: DomainEvent): Promise<void> {
    // Validate at the in-process boundary so a typo at a publish site
    // ("ArtifactUpload" vs "ArtifactUploaded") fails fast instead of
    // silently dispatching to zero subscribers.
    const parseResult = domainEventSchema.safeParse(event);
    if (!parseResult.success) {
      this.logger?.error(
        { eventType: event.type, issues: parseResult.error.issues },
        "Refusing to publish malformed event",
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
        this.logger?.error(
          { eventType: validated.type, err },
          "Event handler failed",
        );
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
