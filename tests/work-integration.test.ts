import { describe, expect, it } from "vitest";
import {
  filterCoworkerCandidates,
  meetingCalendarWindow,
  resolveLinkedProjectStatus,
  resolveLinkedTaskStatus,
  workTaskLane,
} from "@/lib/work";

// Pure logic behind the Work ↔ Do/Calendar/Rolodex/Projects integration:
// which lane a backing DoItem gets, how a meeting maps to a calendar window,
// how linked statuses combine, and which Rolodex people count as coworkers.

const today = new Date(2026, 6, 14, 9, 0); // Tue Jul 14 2026, 09:00 local

describe("workTaskLane", () => {
  it("important tasks land in today regardless of due date", () => {
    expect(workTaskLane(null, true, today)).toBe("today");
    expect(workTaskLane(new Date(2026, 6, 20).toISOString(), true, today)).toBe("today");
  });

  it("tasks due today or overdue land in today", () => {
    expect(workTaskLane(new Date(2026, 6, 14).toISOString(), false, today)).toBe("today");
    expect(workTaskLane(new Date(2026, 6, 13).toISOString(), false, today)).toBe("today");
    expect(workTaskLane(new Date(2026, 6, 14, 23, 30).toISOString(), false, today)).toBe("today");
  });

  it("future-due and undated tasks queue in next", () => {
    expect(workTaskLane(new Date(2026, 6, 15).toISOString(), false, today)).toBe("next");
    expect(workTaskLane(null, false, today)).toBe("next");
  });
});

describe("meetingCalendarWindow", () => {
  const start = new Date(2026, 6, 14, 10, 0);

  it("uses the given duration", () => {
    const { startsAt, endsAt } = meetingCalendarWindow(start.toISOString(), 45);
    expect(startsAt.getTime()).toBe(start.getTime());
    expect(endsAt.getTime() - startsAt.getTime()).toBe(45 * 60_000);
  });

  it("defaults to 30 minutes when duration is missing or invalid", () => {
    expect(
      meetingCalendarWindow(start.toISOString(), null).endsAt.getTime() - start.getTime(),
    ).toBe(30 * 60_000);
    expect(
      meetingCalendarWindow(start.toISOString(), 0).endsAt.getTime() - start.getTime(),
    ).toBe(30 * 60_000);
  });
});

describe("resolveLinkedTaskStatus", () => {
  it("done on either side wins", () => {
    expect(resolveLinkedTaskStatus("done", "ready")).toBe("done");
    expect(resolveLinkedTaskStatus("open", "done")).toBe("done");
  });

  it("waiting on either side wins next", () => {
    expect(resolveLinkedTaskStatus("waiting", "ready")).toBe("waiting");
    expect(resolveLinkedTaskStatus("open", "waiting")).toBe("waiting");
  });

  it("everything else is open (in_progress/scheduled map to open work-side)", () => {
    expect(resolveLinkedTaskStatus("open", "ready")).toBe("open");
    expect(resolveLinkedTaskStatus("open", "in_progress")).toBe("open");
    expect(resolveLinkedTaskStatus("open", null)).toBe("open");
  });
});

describe("resolveLinkedProjectStatus", () => {
  it("linked project terminal states win", () => {
    expect(resolveLinkedProjectStatus("active", "done")).toBe("done");
    expect(resolveLinkedProjectStatus("waiting", "paused")).toBe("paused");
  });

  it("work-side waiting survives an active linked project", () => {
    expect(resolveLinkedProjectStatus("waiting", "active")).toBe("waiting");
    expect(resolveLinkedProjectStatus("waiting", "final_push")).toBe("waiting");
  });

  it("unlinked projects keep the work-side status", () => {
    expect(resolveLinkedProjectStatus("active", null)).toBe("active");
    expect(resolveLinkedProjectStatus("done", null)).toBe("done");
  });

  it("exploring/active/final_push all read as active", () => {
    expect(resolveLinkedProjectStatus("active", "exploring")).toBe("active");
    expect(resolveLinkedProjectStatus("active", "final_push")).toBe("active");
  });
});

describe("filterCoworkerCandidates", () => {
  const persons = [
    { id: "p1", displayName: "Ana", organization: "Lucid Motors", relationshipType: null, contactKind: "person" },
    { id: "p2", displayName: "Ben", organization: null, relationshipType: "coworker", contactKind: "person" },
    { id: "p3", displayName: "Cam", organization: "Acme", relationshipType: "friend", contactKind: "person" },
    { id: "p4", displayName: "Rex", organization: "Lucid Motors", relationshipType: null, contactKind: "pet" },
    { id: "p5", displayName: "Dia", organization: "lucid motors inc", relationshipType: null, contactKind: "person" },
  ];

  it("matches org substring (case-insensitive) or coworker relationship", () => {
    const out = filterCoworkerCandidates(persons, [], "Lucid");
    expect(out.map((p) => p.id)).toEqual(["p1", "p2", "p5"]);
  });

  it("excludes already-linked people and non-person contacts", () => {
    const out = filterCoworkerCandidates(persons, ["p1", null], "Lucid");
    expect(out.map((p) => p.id)).toEqual(["p2", "p5"]);
  });

  it("with no org matches, coworkers still qualify", () => {
    const out = filterCoworkerCandidates(persons, [], "Globex");
    expect(out.map((p) => p.id)).toEqual(["p2"]);
  });
});
