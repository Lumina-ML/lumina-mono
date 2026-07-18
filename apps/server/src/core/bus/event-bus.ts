import type { DomainEvent, KnownDomainEvent } from "../events/domain-event.js";

export type EventHandler<T extends DomainEvent = DomainEvent> = (event: T) => void | Promise<void>;

export interface EventBus {
  publish(event: DomainEvent): Promise<void>;
  subscribe<T extends KnownDomainEvent["type"]>(
    eventType: T,
    handler: EventHandler<Extract<KnownDomainEvent, { type: T }>>,
  ): void;
}
