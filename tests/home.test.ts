import { describe, expect, it } from "vitest";
import {
  cadenceLabel,
  groupHomeTasks,
  homeDaysUntil,
  homeDueLabel,
  householdNudgeText,
  nextAssignee,
  nextDueAfterDone,
  parseListItemsInput,
} from "@/lib/home";

describe("parseListItemsInput", () => {
  it("splits on commas and newlines, trims and dedupes", () => {
    expect(parseListItemsInput(" milk, eggs\nbread ,, Milk\n  oat  milk ")).toEqual([
      "milk",
      "eggs",
      "bread",
      "oat milk",
    ]);
  });
});

describe("cadenceLabel", () => {
  it("names common cadences", () => {
    expect(cadenceLabel(1)).toBe("Daily");
    expect(cadenceLabel(7)).toBe("Weekly");
    expect(cadenceLabel(14)).toBe("Every 2 weeks");
    expect(cadenceLabel(30)).toBe("Monthly");
    expect(cadenceLabel(90)).toBe("Every 3 months");
    expect(cadenceLabel(365)).toBe("Yearly");
    expect(cadenceLabel(10)).toBe("Every 10 days");
  });
});

describe("due dates", () => {
  const now = new Date(2026, 10, 10, 20);
  it("counts calendar days and labels them", () => {
    expect(homeDaysUntil(new Date(2026, 10, 11, 1), now)).toBe(1);
    expect(homeDueLabel(-2)).toBe("2 days late");
    expect(homeDueLabel(0)).toBe("Today");
    expect(homeDueLabel(30)).toBe("In 4 weeks");
    expect(homeDueLabel(90)).toBe("In 3 months");
  });

  it("schedules the next cycle from the completion day", () => {
    const next = nextDueAfterDone(new Date(2026, 10, 10, 22), 7);
    expect([next.getMonth(), next.getDate(), next.getHours()]).toEqual([10, 17, 9]);
  });

  it("groups due-now vs upcoming", () => {
    const { dueNow, upcoming } = groupHomeTasks(
      [
        { id: "a", kind: "chore", nextDueAt: new Date(2026, 10, 12) },
        { id: "b", kind: "chore", nextDueAt: new Date(2026, 10, 9) },
        { id: "c", kind: "maintenance", nextDueAt: new Date(2026, 10, 10, 7) },
      ],
      now,
    );
    expect(dueNow.map((t) => t.id)).toEqual(["b", "c"]);
    expect(upcoming.map((t) => t.id)).toEqual(["a"]);
  });
});

describe("nextAssignee", () => {
  const members = ["josh", "ana"];
  it("rotates between members", () => {
    expect(nextAssignee({ rotate: true, assigneeUserId: "josh", doneByUserId: "josh", memberUserIds: members })).toBe("ana");
    expect(nextAssignee({ rotate: true, assigneeUserId: "ana", doneByUserId: "josh", memberUserIds: members })).toBe("josh");
    expect(nextAssignee({ rotate: true, assigneeUserId: null, doneByUserId: "ana", memberUserIds: members })).toBe("josh");
  });
  it("keeps fixed assignees and single-member households", () => {
    expect(nextAssignee({ rotate: false, assigneeUserId: "ana", doneByUserId: "josh", memberUserIds: members })).toBe("ana");
    expect(nextAssignee({ rotate: true, assigneeUserId: null, doneByUserId: "josh", memberUserIds: ["josh"] })).toBeNull();
  });
});

describe("householdNudgeText", () => {
  it("is null when nothing is due", () => {
    expect(householdNudgeText({ dueTaskTitles: [], bills: [] })).toBeNull();
  });
  it("mentions tasks and bills", () => {
    expect(
      householdNudgeText({
        dueTaskTitles: ["Replace HVAC filter"],
        bills: [{ name: "Rent", daysUntil: 1 }],
      })?.body,
    ).toBe("Replace HVAC filter is due. Rent is due tomorrow.");
  });
});
