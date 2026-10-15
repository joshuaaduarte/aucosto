import { describe, expect, it, vi } from "vitest";

// @/lib/assistant-auth imports @/auth (next-auth), whose `next/server`
// subpath import vitest can't resolve — stub it; these tests only exercise
// the pure bearer-matching logic.
vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { bearerMatches } from "@/lib/assistant-auth";

describe("bearerMatches", () => {
  const secret = "test-secret-value-123";

  it("matches the exact secret", () => {
    expect(bearerMatches(`Bearer ${secret}`, secret)).toBe(true);
  });

  it("rejects a wrong token", () => {
    expect(bearerMatches("Bearer wrong-secret", secret)).toBe(false);
  });

  it("rejects a missing header", () => {
    expect(bearerMatches(null, secret)).toBe(false);
  });

  it("rejects non-Bearer schemes", () => {
    expect(bearerMatches(`Basic ${secret}`, secret)).toBe(false);
    expect(bearerMatches(secret, secret)).toBe(false);
  });

  it("rejects an empty token", () => {
    expect(bearerMatches("Bearer ", secret)).toBe(false);
    expect(bearerMatches("Bearer", secret)).toBe(false);
  });

  it("rejects tokens of a different length than the secret", () => {
    // Guards the timingSafeEqual length-mismatch throw.
    expect(bearerMatches("Bearer short", secret)).toBe(false);
    expect(bearerMatches(`Bearer ${secret}-with-extra`, secret)).toBe(false);
  });

  it("is case-sensitive on the scheme prefix", () => {
    expect(bearerMatches(`bearer ${secret}`, secret)).toBe(false);
  });
});
