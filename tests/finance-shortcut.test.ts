import { describe, expect, it } from "vitest";
import {
  buildShortcutKey,
  shortcutAmountCents,
  shortcutEntrySchema,
  shortcutKeyMatches,
  shortcutKeyUserId,
} from "@/lib/finance-shortcut";

describe("shortcut keys", () => {
  const key = buildShortcutKey("secret", "cmuser123abc", "evt1");

  it("carries the user id and verifies against the current version", () => {
    expect(shortcutKeyUserId(key)).toBe("cmuser123abc");
    expect(shortcutKeyMatches("secret", key, "cmuser123abc", "evt1")).toBe(true);
  });

  it("stops working when a new key is made or the secret changes", () => {
    expect(shortcutKeyMatches("secret", key, "cmuser123abc", "evt2")).toBe(false);
    expect(shortcutKeyMatches("other", key, "cmuser123abc", "evt1")).toBe(false);
    expect(shortcutKeyMatches("secret", key, "someoneelse", "evt1")).toBe(false);
  });

  it("rejects malformed keys", () => {
    expect(shortcutKeyUserId("nodot")).toBeNull();
    expect(shortcutKeyUserId("a.b.c")).toBeNull();
    expect(shortcutKeyUserId(`${Buffer.from("x y").toString("base64url")}.sig`)).toBeNull();
  });
});

describe("shortcut body", () => {
  it("accepts numbers or strings for the amount", () => {
    expect(shortcutAmountCents(12.5)).toBe(1250);
    expect(shortcutAmountCents("$1,200")).toBe(120000);
    expect(shortcutAmountCents("abc")).toBeNull();
    expect(shortcutAmountCents("0")).toBeNull();
  });
  it("validates the rest", () => {
    expect(shortcutEntrySchema.safeParse({ amount: "5", description: "Coffee" }).success).toBe(true);
    expect(shortcutEntrySchema.safeParse({ amount: "5", date: "11/02/2026" }).success).toBe(false);
    expect(shortcutEntrySchema.safeParse({}).success).toBe(false);
  });
});
