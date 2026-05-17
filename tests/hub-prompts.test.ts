import { describe, expect, it } from "vitest";
import { deriveHubPrompts } from "@/app/app/_lib/hub-prompts";
import type { FinanceAccount, TimeEntry } from "@/generated/prisma/client";

function account(overrides: Partial<FinanceAccount> = {}): FinanceAccount {
  const now = new Date();
  return {
    id: "acc-1",
    userId: "user-1",
    connectionId: null,
    externalId: null,
    syncSource: "manual",
    name: "Test Card",
    kind: "credit_card",
    currency: "USD",
    includeInNetWorth: true,
    includeInCashPosition: false,
    currentBalanceCents: -50000,
    balanceUpdatedAt: now,
    statementBalanceCents: -50000,
    dueDate: null,
    creditLimitCents: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as FinanceAccount;
}

function runningEntry(
  overrides: Partial<TimeEntry> = {},
): Pick<TimeEntry, "label" | "category" | "startedAt"> {
  return {
    label: "Focus block",
    category: "Deep work",
    startedAt: new Date(Date.now() - 12 * 60 * 1000),
    ...overrides,
  } as TimeEntry;
}

describe("deriveHubPrompts", () => {
  it("leads with the running timer when one is active", () => {
    const prompts = deriveHubPrompts({
      runningEntry: runningEntry(),
      weekTotalMs: 0,
    });

    expect(prompts[0]?.text).toContain("Focus block");
    expect(prompts[0]?.tone).toBe("sky");
  });

  it("uses the weekly tracked total when no timer is running", () => {
    const prompts = deriveHubPrompts({
      runningEntry: null,
      weekTotalMs: 2 * 60 * 60 * 1000, // 2h
    });

    expect(prompts[0]?.text).toMatch(/^2\.0h tracked/);
  });

  it("surfaces an amber due-soon prompt for cards due in <=3 days", () => {
    const dueIn = new Date();
    dueIn.setDate(dueIn.getDate() + 2);

    const prompts = deriveHubPrompts({
      runningEntry: null,
      weekTotalMs: 0,
      accounts: [account({ dueDate: dueIn })],
    });

    const due = prompts.find((p) => p.text.includes("due in"));
    expect(due?.tone).toBe("amber");
  });

  it("flags spend pace when the month delta is >=10%", () => {
    const prompts = deriveHubPrompts({
      runningEntry: null,
      weekTotalMs: 0,
      thisMonthSpentCents: 200000,
      lastMonthSpentCents: 100000,
    });

    const pace = prompts.find((p) => p.text.includes("Spend pace"));
    expect(pace?.tone).toBe("amber");
  });

  it("falls back to evergreen prompts when no data is available", () => {
    const prompts = deriveHubPrompts({ runningEntry: null, weekTotalMs: 0 });
    expect(prompts.length).toBeGreaterThan(0);
    expect(prompts.every((p) => typeof p.text === "string")).toBe(true);
  });
});
