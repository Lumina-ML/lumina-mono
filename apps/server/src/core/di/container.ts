import { DependencyContainer, container as defaultContainer } from "tsyringe";

/**
 * Root DI container for the server.
 *
 * Tokens (Symbol-keyed) are declared in `./tokens.ts` and registered by the
 * composition-root plugin (`apps/server/src/plugins/di.ts`). Services that
 * need other services depend on them via constructor `@inject(TOKENS.X)` and
 * are themselves decorated with `@injectable()`. Application code should
 * resolve services through this container, never `new` them directly.
 *
 * Tests should `resetContainer()` in `beforeEach` and re-register mocks.
 */
export const container: DependencyContainer = defaultContainer;

export function resetContainer(): void {
  container.reset();
}