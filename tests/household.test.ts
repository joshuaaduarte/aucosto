import { describe, expect, it } from "vitest";
import {
  inviteExpiry,
  inviteStatus,
  isPartnerPathAllowed,
  normalizeEmail,
  parseFinanceScope,
} from "@/lib/household-access";
import { withActorMeta } from "@/lib/services/events";

describe("isPartnerPathAllowed", () => {
  it("allows Home, Finance and Settings, including sub-paths", () => {
    expect(isPartnerPathAllowed("/app/home")).toBe(true);
    expect(isPartnerPathAllowed("/app/finance")).toBe(true);
    expect(isPartnerPathAllowed("/app/settings")).toBe(true);
    expect(isPartnerPathAllowed("/app/finance/anything")).toBe(true);
  });

  it("blocks the hub and every personal tool", () => {
    for (const path of [
      "/app",
      "/app/time",
      "/app/do",
      "/app/habits",
      "/app/reflect",
      "/app/rolodex",
      "/app/work",
      "/app/assistant",
      "/app/insights",
      "/app/calendar",
      "",
    ]) {
      expect(isPartnerPathAllowed(path), path).toBe(false);
    }
  });

  it("does not match lookalike prefixes", () => {
    expect(isPartnerPathAllowed("/app/homework")).toBe(false);
    expect(isPartnerPathAllowed("/app/finance-secret")).toBe(false);
  });
});

describe("invites", () => {
  it("normalizes emails", () => {
    expect(normalizeEmail("  Ana@Example.COM ")).toBe("ana@example.com");
  });

  it("expires after 7 days and reports status", () => {
    const now = new Date("2026-11-02T12:00:00Z");
    const expiresAt = inviteExpiry(now);
    expect(expiresAt.toISOString()).toBe("2026-11-09T12:00:00.000Z");
    expect(inviteStatus({ expiresAt, acceptedAt: null }, now)).toBe("valid");
    expect(inviteStatus({ expiresAt, acceptedAt: null }, expiresAt)).toBe("expired");
    expect(inviteStatus({ expiresAt, acceptedAt: now }, now)).toBe("accepted");
  });
});

describe("parseFinanceScope", () => {
  it("defaults to household", () => {
    expect(parseFinanceScope(undefined)).toBe("household");
    expect(parseFinanceScope("weird")).toBe("household");
    expect(parseFinanceScope("personal")).toBe("personal");
  });
});

describe("withActorMeta", () => {
  it("leaves meta alone when the actor owns the scope or is unknown", () => {
    expect(withActorMeta({ a: 1 }, "u1", "u1")).toEqual({ a: 1 });
    expect(withActorMeta({ a: 1 }, "u1", null)).toEqual({ a: 1 });
    expect(withActorMeta(null, "u1", null)).toBeUndefined();
  });

  it("stamps actorUserId for shared scopes", () => {
    expect(withActorMeta(null, "household", "ana")).toEqual({ actorUserId: "ana" });
    expect(withActorMeta({ count: 2 }, "household", "ana")).toEqual({ count: 2, actorUserId: "ana" });
  });

  it("stamps via when an agent made the write", () => {
    expect(withActorMeta(null, "u1", null, "agent")).toEqual({ via: "agent" });
    expect(withActorMeta({ a: 1 }, "u1", "u1", "agent")).toEqual({ a: 1, via: "agent" });
    expect(withActorMeta({ a: 1 }, "household", "ana", "agent")).toEqual({
      a: 1,
      actorUserId: "ana",
      via: "agent",
    });
  });
});
