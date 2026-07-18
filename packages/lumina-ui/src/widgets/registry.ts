import type { WidgetDefinition } from "./types";

const registry = new Map<string, WidgetDefinition>();

export function registerWidget(definition: WidgetDefinition): void {
  if (registry.has(definition.type)) {
    console.warn(`[Lumina Widget] Widget type "${definition.type}" is already registered and will be overwritten.`);
  }
  registry.set(definition.type, definition);
}

export function registerWidgets(definitions: WidgetDefinition[]): void {
  for (const def of definitions) {
    registerWidget(def);
  }
}

export function getWidget(type: string): WidgetDefinition | undefined {
  return registry.get(type);
}

export function listWidgets(): WidgetDefinition[] {
  return Array.from(registry.values());
}

export function hasWidget(type: string): boolean {
  return registry.has(type);
}
