// Vitest setup. Shared globals go here; per-test setup lives in helpers.

// MUST run before any tsyringe / decorator-using module is imported so
// the runtime `Reflect.metadata` polyfill is available. `bootstrap.ts`
// does this at the top of the server entry; the test runner needs the
// same polyfill because tests now resolve services via the same DI
// container.
import "reflect-metadata";

export {};