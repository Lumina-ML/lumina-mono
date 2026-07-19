import { describe, it, expect } from "vitest";
import { redactSecrets, redactLogMessage } from "./useLogRedaction";

describe("redactSecrets", () => {
  it("redacts KEY=VALUE env-style secrets", () => {
    const longToken = "sk-".padEnd(40, "x") + "1234";
    const input = `OPENAI_API_KEY=${longToken}`;
    expect(redactSecrets(input)).toBe(`OPENAI_API_KEY=[REDACTED]`);
  });

  it("redacts Bearer tokens", () => {
    const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
      .padEnd(60, "x");
    expect(redactSecrets(`Authorization: Bearer ${token}`)).toBe(
      "Authorization: Bearer [REDACTED]",
    );
  });

  it("redacts JWT-shaped strings", () => {
    const jwt =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    expect(redactSecrets(`token=${jwt}`)).toBe(`token=[REDACTED]`);
  });

  it("redacts token= / key: / password= prefixes", () => {
    const secret = "a".repeat(40) + "1234";
    expect(redactSecrets(`password=${secret}`)).toBe(`password=[REDACTED]`);
    expect(redactSecrets(`api_key: ${secret}`)).toBe(`api_key: [REDACTED]`);
    expect(redactSecrets(`token=${secret}`)).toBe(`token=[REDACTED]`);
  });

  it("leaves short values alone", () => {
    expect(redactSecrets("count=42")).toBe("count=42");
    expect(redactSecrets("user=alice")).toBe("user=alice");
    expect(redactSecrets("status=ok")).toBe("status=ok");
  });

  it("leaves normal log messages alone", () => {
    const msg =
      "Epoch 1/10 — loss=0.42, val_accuracy=0.89 — ETA 3m";
    expect(redactSecrets(msg)).toBe(msg);
  });

  it("respects custom placeholder", () => {
    const longToken = "abc".repeat(15);
    expect(
      redactSecrets(`KEY=${longToken}`, { placeholder: "***" }),
    ).toBe("KEY=***");
  });

  it("applies extraPatterns", () => {
    expect(
      redactSecrets("custom-secret-12345", {
        extraPatterns: [/custom-secret-\d+/g],
      }),
    ).toBe("[REDACTED]");
  });

  it("handles multiple secrets in one line", () => {
    const a = "a".repeat(35);
    const b = "b".repeat(35);
    expect(redactSecrets(`KEY_A=${a} KEY_B=${b}`)).toBe(
      "KEY_A=[REDACTED] KEY_B=[REDACTED]",
    );
  });

  it("redactLogMessage is the same call as redactSecrets", () => {
    const longToken = "sk-".padEnd(40, "x") + "1234";
    const input = `OPENAI_API_KEY=${longToken}`;
    expect(redactLogMessage(input)).toBe(redactSecrets(input));
  });

  it("returns empty string unchanged", () => {
    expect(redactSecrets("")).toBe("");
  });
});