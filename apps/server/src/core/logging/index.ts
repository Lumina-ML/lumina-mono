/**
 * Centralized logging infrastructure for the server's *operational* logs
 * (pino), as opposed to the `log-line` module which captures application
 * logs emitted by ML runs.
 *
 * Why this lives in one place:
 * - The Fastify logger is constructed at `fastify({ logger })` time, which
 *   runs *before* the config plugin loads. So both `buildApp` (HTTP) and
 *   `buildWorker` (jobs) used to inline `{ level: process.env.LOG_LEVEL }`
 *   with no redaction, serializers, or pretty-printing. This factory is the
 *   single source of truth for both processes.
 * - `level` mirrors the same env var the config schema validates
 *   (`LOG_LEVEL`), so the logger and `app.config.logLevel` agree even though
 *   the logger is built earlier.
 *
 * Features:
 * - `redact`: a safety net so a stray `req.log.info({ headers })` or
 *   `{ user }` can't leak bearer tokens / passwords / api keys into logs.
 * - `base`: tags every line with the process (`lumina-server` vs
 *   `lumina-worker`) and env, which matters once both ship to one log sink.
 * - dev pretty-print: `pino-pretty` transport only in `development` so local
 *   logs are colorized and human-readable; production/test stay JSON.
 */
import { createRequire } from "node:module";
import type { LoggerOptions } from "pino";

const require = createRequire(import.meta.url);

export const DEFAULT_REQUEST_ID_HEADER = "x-request-id";

/**
 * Header used to propagate a client-supplied request id. Read from env
 * (mirrors `REQUEST_ID_HEADER` in the config schema) and lowercased for
 * case-insensitive header lookup. Resolved here — not from `app.config` —
 * because `genReqId` runs before the config plugin is registered.
 */
export function requestIdHeader(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return (env.REQUEST_ID_HEADER ?? DEFAULT_REQUEST_ID_HEADER).toLowerCase();
}

/**
 * Paths pino should scrub before writing a log line. Covers both the raw
 * shapes (`headers.authorization`) and the Fastify-serialized shapes
 * (`req.headers.authorization`), plus one level of nesting for common
 * secret-bearing object keys (`*.password` matches `{ user: { password } }`).
 */
const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "headers.authorization",
  "headers.cookie",
  "authorization",
  "apiKey",
  "apiKeyHash",
  "password",
  "secret",
  "token",
  "*.authorization",
  "*.apiKey",
  "*.apiKeyHash",
  "*.password",
  "*.secret",
  "*.token",
];

export interface LoggerOptionsInput {
  /** Process name tag, e.g. "lumina-server" or "lumina-worker". */
  name: string;
  /** Override log level; defaults to `LOG_LEVEL` env, then "info". */
  level?: string;
  /** Override env; defaults to `NODE_ENV` env, then "development". */
  nodeEnv?: string;
}

/**
 * Build the pino options object passed to `fastify({ logger })`. The return
 * value is assignable to Fastify's logger option.
 */
export function buildLoggerOptions(input: LoggerOptionsInput): LoggerOptions {
  const level = input.level ?? process.env.LOG_LEVEL ?? "info";
  const nodeEnv = input.nodeEnv ?? process.env.NODE_ENV ?? "development";
  const isDev = nodeEnv === "development";

  const options: LoggerOptions = {
    level,
    base: { service: input.name, env: nodeEnv },
    redact: {
      paths: REDACT_PATHS,
      censor: "[Redacted]",
    },
  };

  // Pretty-print only in development. `pino-pretty` runs in a transport
  // worker thread and is a devDependency — never loaded in production/test,
  // where structured JSON is piped to the log collector as-is.
  //
  // The worker resolves its `target` by module name from pino's own
  // directory, which fails under pnpm's non-hoisted `node_modules`
  // ("unable to determine transport target for pino-pretty"). Resolve it
  // to an absolute path against this package instead.
  if (isDev) {
    options.transport = {
      target: require.resolve("pino-pretty"),
      options: {
        colorize: true,
        translateTime: "SYS:HH:MM:ss.l",
        ignore: "pid,hostname",
        singleLine: false,
      },
    };
  }

  return options;
}
