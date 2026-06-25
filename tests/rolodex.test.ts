import { describe, expect, it, vi } from "vitest";
import type { RolodexPersonSummary } from "@/lib/services/rolodex";

// Pure logic tests — mock DB calls so no real DB is needed.
// The findPersonByName function does its matching in JS after fetching all persons,
// so we can test the matching logic by mocking listPersons.

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

// ── findPersonByName matching logic (pure part extracted for testing) ──────

function matchPersons(
  persons: Pick<RolodexPersonSummary, "id" | "displayName" | "firstName" | "lastName" | "aliases">[],
  name: string,
): typeof persons {
  const lower = name.toLowerCase();
  return persons.filter(
    (p) =>
      p.displayName.toLowerCase().includes(lower) ||
      (p.firstName?.toLowerCase().includes(lower) ?? false) ||
      (p.lastName?.toLowerCase().includes(lower) ?? false) ||
      p.aliases.some((a) => a.toLowerCase().includes(lower)),
  );
}

describe("findPersonByName matching", () => {
  const persons: Pick<RolodexPersonSummary, "id" | "displayName" | "firstName" | "lastName" | "aliases">[] = [
    { id: "1", displayName: "Alice Smith", firstName: "Alice", lastName: "Smith", aliases: ["Al"] },
    { id: "2", displayName: "Bob Jones", firstName: "Bob", lastName: "Jones", aliases: ["Robert"] },
    { id: "3", displayName: "Alice Cooper", firstName: "Alice", lastName: "Cooper", aliases: [] },
  ];

  it("exact displayName match returns single result", () => {
    const results = matchPersons(persons, "Bob Jones");
    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe("2");
  });

  it("alias match resolves person", () => {
    const results = matchPersons(persons, "Robert");
    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe("2");
  });

  it("partial first name match returns multiple candidates", () => {
    const results = matchPersons(persons, "Alice");
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.id)).toContain("1");
    expect(results.map((r) => r.id)).toContain("3");
  });

  it("no match returns empty array", () => {
    const results = matchPersons(persons, "Nonexistent Person");
    expect(results).toHaveLength(0);
  });

  it("case-insensitive match works", () => {
    const results = matchPersons(persons, "alice smith");
    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe("1");
  });

  it("alias case-insensitive match works", () => {
    const results = matchPersons(persons, "al");
    expect(results).toHaveLength(2); // "Al" alias from Alice Smith, "Alice" first name from Alice Cooper
  });

  it("partial last name match", () => {
    const results = matchPersons(persons, "smith");
    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe("1");
  });
});

// ── Project planning snapshot tests ───────────────────────────────────────

import { computeSignals } from "@/lib/assistant-signals";
import type { SignalFacts } from "@/lib/assistant-signals";

function makeMinimalFacts(
  overrides: Partial<SignalFacts["today"]["projects"][number]>[] = [],
): SignalFacts {
  return {
    today: {
      wokeUpAt: "07:00",
      calendar: { items: [], totalScheduledMinutes: 0 },
      time: { runningTimer: null, totalTrackedMinutes: 0 },
      tasks: { open: [] },
      habits: { items: [] },
      projects: overrides.map((o) => ({
        name: "Test Project",
        momentum: "stalled",
        openTaskCount: 1,
        nextAction: null,
        blockers: [],
        missingNextAction: false,
        ...o,
      })),
    },
    yesterday: { habitsCompleted: 0, habitsTotal: 0 },
    finance: { visible: false },
  };
}

describe("projectsMissingNextAction signal", () => {
  it("project with null nextAction and missingNextAction=true appears in signal", () => {
    const facts = makeMinimalFacts([{ missingNextAction: true, nextAction: null, openTaskCount: 1 }]);
    const signals = computeSignals(facts, 10 * 60);
    expect(signals.projectsMissingNextAction).toContain("Test Project");
  });

  it("project with nextAction set does not appear in signal", () => {
    const facts = makeMinimalFacts([{ missingNextAction: false, nextAction: "Write docs" }]);
    const signals = computeSignals(facts, 10 * 60);
    expect(signals.projectsMissingNextAction).toHaveLength(0);
  });

  it("project with no open tasks excluded from signal even if missingNextAction=true", () => {
    const facts = makeMinimalFacts([{ missingNextAction: true, openTaskCount: 0 }]);
    const signals = computeSignals(facts, 10 * 60);
    expect(signals.projectsMissingNextAction).toHaveLength(0);
  });
});

describe("stalledProjects signal still works", () => {
  it("stalled project with open tasks appears in stalledProjects", () => {
    const facts = makeMinimalFacts([{ momentum: "stalled", openTaskCount: 2 }]);
    const signals = computeSignals(facts, 10 * 60);
    expect(signals.stalledProjects).toContain("Test Project");
  });
});
