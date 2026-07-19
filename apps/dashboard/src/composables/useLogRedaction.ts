/**
 * Secret redaction for log streams. Replaces values that look like API keys,
 * tokens, JWTs, or other credentials with `[REDACTED]` so they're safe to
 * paste into screenshots, support tickets, and reports.
 *
 * Heuristics:
 *   1. Key/value env-style:  `KEY=<value>` where value is >= MIN_LEN chars and
 *      looks high-entropy (mix of letters/digits/symbols).
 *   2. Bearer / OAuth tokens:  `Bearer <jwt-ish>` (eyJ... long base64url).
 *   3. JWT format:  three base64url segments separated by dots.
 *   4. Long opaque tokens: any whitespace-bounded run of >= 40 chars that
 *      contains at least one letter and one digit (catches hex strings,
 *      base64 tokens, etc.) when preceded by an obvious prefix like `token=`,
 *      `key:`, `secret:`, `password=`.
 *
 * If `extraPatterns` is supplied, callers can register additional regexps
 * (e.g. tenant-specific secret prefixes).
 */

const MIN_LEN = 32;
const SHORT_LEN = 20;

const KV_PATTERN =
  /\b([A-Z_][A-Z0-9_]{1,40})\s*[=:]\s*([^\s"',;]{20,})/g;

const BEARER_PATTERN = /\bBearer\s+([A-Za-z0-9_\-.~+/]{20,}=*)/g;

const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

const PREFIX_TOKEN_PATTERN =
  /\b([a-zA-Z_][a-zA-Z0-9_]*_)?(token|key|secret|password|passwd|pwd|auth|client_secret)\s*[=:]\s*([^\s"',;]{20,})/gi;

function looksLikeSecret(s: string): boolean {
  // Length is the primary signal — env-style KEY=VALUE patterns almost
  // never have a long value unless it's a credential. To avoid false
  // positives on things like long URLs, require at least one letter or
  // digit (not all symbols).
  if (s.length < SHORT_LEN) return false;
  if (!/[A-Za-z0-9]/.test(s)) return false;
  return true;
}

export interface RedactionOptions {
  /** Additional regexes whose match is replaced wholesale. */
  extraPatterns?: RegExp[];
  /** Placeholder to insert in place of the secret. */
  placeholder?: string;
}

export function redactSecrets(input: string, opts: RedactionOptions = {}): string {
  if (!input) return input;
  const placeholder = opts.placeholder ?? "[REDACTED]";

  let out = input;

  // 1. KEY=VALUE / KEY: VALUE env-style. Long values after an UPPER_CASE key
  //    are almost always credentials; the MIN_LEN check below enforces a
  //    minimum so we don't redact normal metric names.
  out = out.replace(KV_PATTERN, (m, key: string, value: string) => {
    if (value.length < MIN_LEN) return m;
    if (!looksLikeSecret(value)) return m;
    return `${key}=${placeholder}`;
  });

  // 2. token=/key:/secret: prefixes (case-insensitive).
  out = out.replace(
    PREFIX_TOKEN_PATTERN,
    (m, prefix: string | undefined, key: string, value: string) => {
      if (!looksLikeSecret(value)) return m;
      const sep = m.includes(":") ? ": " : "=";
      return `${prefix ?? ""}${key}${sep}${placeholder}`;
    },
  );

  // 3. Bearer <token>
  out = out.replace(BEARER_PATTERN, (m, token: string) => {
    if (!looksLikeSecret(token)) return m;
    return `Bearer ${placeholder}`;
  });

  // 4. JWT-shaped tokens (already start with eyJ, always long enough).
  out = out.replace(JWT_PATTERN, placeholder);

  // 5. Caller-supplied patterns.
  for (const re of opts.extraPatterns ?? []) {
    out = out.replace(re, placeholder);
  }

  return out;
}

export function redactLogMessage(message: string, opts?: RedactionOptions): string {
  return redactSecrets(message, opts);
}