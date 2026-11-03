import { describe, expect, it } from "vitest";
import {
  addMinutesToClock,
  applyKeypadKey,
  guessCapture,
  habitsToOffer,
  hourCaptureMode,
  nextHalfHour,
  peopleToOffer,
  captureEntries,
  choresToOffer,
  financeCategoryLook,
  formatTypedAmount,
  rankCategories,
  rememberCaptureMode,
  suggestCaptureModes,
  recentTimerLabels,
  type KeypadKey,
} from "@/lib/quick-capture";

function type(keys: KeypadKey[]): string {
  return keys.reduce((acc, key) => applyKeypadKey(acc, key), "");
}

describe("applyKeypadKey", () => {
  it("builds an amount digit by digit", () => {
    expect(type(["6", "4", ".", "2", "0"])).toBe("64.20");
  });
  it("caps decimals at two", () => {
    expect(type(["1", ".", "2", "3", "4"])).toBe("1.23");
  });
  it("starts a bare decimal with zero and ignores a second dot", () => {
    expect(type([".", "5", "."])).toBe("0.5");
  });
  it("drops a leading zero", () => {
    expect(type(["0", "5"])).toBe("5");
    expect(type(["0", ".", "5"])).toBe("0.5");
  });
  it("caps whole digits", () => {
    expect(type(["9", "9", "9", "9", "9", "9", "9", "9"])).toBe("9999999");
  });
  it("backspaces", () => {
    expect(type(["1", "2", "back"])).toBe("1");
    expect(applyKeypadKey("", "back")).toBe("");
  });
});

describe("formatTypedAmount", () => {
  it("groups thousands and keeps typed decimals", () => {
    expect(formatTypedAmount("")).toBe("0");
    expect(formatTypedAmount("1234.5")).toBe("1,234.5");
    expect(formatTypedAmount("0.")).toBe("0.");
  });
});

describe("financeCategoryLook", () => {
  it("has an emoji for built-in categories", () => {
    expect(financeCategoryLook("Groceries").emoji).toBe("🛒");
  });
  it("reads a leading emoji off a custom category", () => {
    const look = financeCategoryLook("🎁 Gifts");
    expect(look.emoji).toBe("🎁");
    expect(look.label).toBe("Gifts");
  });
  it("handles custom and empty categories", () => {
    expect(financeCategoryLook("Date night").emoji).toBeNull();
    expect(financeCategoryLook(null).label).toBe("No category");
  });
  it("gives the same color every time", () => {
    expect(financeCategoryLook("Date night").color).toBe(financeCategoryLook("Date night").color);
  });
});

describe("captureEntries", () => {
  it("gives a Home + Money menu only Home and Money entries", () => {
    const modes = captureEntries(["/app/home", "/app/finance"]).map((e) => e.mode);
    expect(modes).toEqual(["spend", "list", "chore-done", "chore-new"]);
  });
  it("drops money when Money is hidden", () => {
    const modes = captureEntries(["/app", "/app/do", "/app/time", "/app/home"]).map((e) => e.mode);
    expect(modes).not.toContain("spend");
    expect(modes).toContain("task");
  });
});

describe("suggestCaptureModes", () => {
  const available = ["spend", "list", "chore-done", "chore-new", "task", "timer"] as const;
  it("puts the page's own entry first", () => {
    expect(suggestCaptureModes({ available, pathname: "/app/home", recent: [] })[0]).toBe("list");
    expect(suggestCaptureModes({ available, pathname: "/app/do/x", recent: [] })[0]).toBe("task");
  });
  it("then the most used, then the built-in order", () => {
    expect(
      suggestCaptureModes({ available, pathname: "/app", recent: ["timer", "task", "timer", "chore-done"] }),
    ).toEqual(["timer", "task", "chore-done"]);
    expect(suggestCaptureModes({ available, pathname: "/app", recent: [] })).toEqual(["spend", "list", "chore-done"]);
  });
  it("never suggests what the viewer can't use", () => {
    expect(
      suggestCaptureModes({ available: ["spend", "list"], pathname: "/app/do", recent: ["timer"] }),
    ).toEqual(["spend", "list"]);
  });
  it("remembers newest first, capped", () => {
    const recent = Array.from({ length: 12 }, () => "list");
    expect(rememberCaptureMode(recent, "task")).toHaveLength(12);
    expect(rememberCaptureMode(recent, "task")[0]).toBe("task");
  });
});

describe("Josh's full menu", () => {
  it("covers every tool with an entry, and a partner still only gets Home + Money", () => {
    const all = captureEntries(["/app", "/app/calendar", "/app/do", "/app/time", "/app/habits", "/app/reflect", "/app/home", "/app/finance", "/app/work", "/app/rolodex"]);
    expect(all.map((e) => e.mode)).toEqual(expect.arrayContaining(["event", "habit", "reflect", "person", "work-note"]));
    expect(captureEntries(["/app/home", "/app/finance"]).every((e) => e.tool === "/app/home" || e.tool === "/app/finance")).toBe(true);
  });
});

describe("hourCaptureMode", () => {
  it("suggests the reflection in the evening until it's done, habits in the morning", () => {
    expect(hourCaptureMode(20, false)).toBe("reflect");
    expect(hourCaptureMode(20, true)).toBeUndefined();
    expect(hourCaptureMode(7, false)).toBe("habit");
    expect(hourCaptureMode(14, false)).toBeUndefined();
  });
  it("comes after the page's entry and before recent picks", () => {
    const available = ["task", "timer", "reflect", "event"] as const;
    expect(
      suggestCaptureModes({ available, pathname: "/app/calendar", recent: ["timer"], hourMode: "reflect" }),
    ).toEqual(["event", "reflect", "timer"]);
  });
});

describe("habitsToOffer", () => {
  const h = (title: string, dayPart: string, dueToday = true, completedToday = false) => ({ title, dayPart, dueToday, completedToday });
  it("keeps due, unfinished habits, the current part of the day first", () => {
    const habits = [h("Read", "evening"), h("Walk", "anytime"), h("Stretch", "morning"), h("Gym", "morning", false), h("Meds", "morning", true, true)];
    expect(habitsToOffer(habits, 8).map((x) => x.title)).toEqual(["Stretch", "Walk", "Read"]);
    expect(habitsToOffer(habits, 20).map((x) => x.title)).toEqual(["Read", "Walk", "Stretch"]);
  });
});

describe("peopleToOffer", () => {
  const people = [
    { name: "Sam Lee", lastAt: "2026-10-01" },
    { name: "Ana", lastAt: "2026-11-01" },
    { name: "Bea Samson", lastAt: null },
  ];
  it("shows recent contacts with no search, name matches (starts-with first) with one", () => {
    expect(peopleToOffer(people, "").map((p) => p.name)).toEqual(["Ana", "Sam Lee", "Bea Samson"]);
    expect(peopleToOffer(people, "sam").map((p) => p.name)).toEqual(["Sam Lee", "Bea Samson"]);
  });
});

describe("event clock helpers", () => {
  it("rounds up to the next half hour and adds durations across midnight", () => {
    expect(nextHalfHour(new Date(2026, 10, 3, 14, 10))).toBe("14:30");
    expect(nextHalfHour(new Date(2026, 10, 3, 14, 40))).toBe("15:00");
    expect(nextHalfHour(new Date(2026, 10, 3, 23, 45))).toBe("00:00");
    expect(addMinutesToClock("23:30", 60)).toBe("00:30");
    expect(addMinutesToClock("09:00", 30)).toBe("09:30");
  });
});

describe("guessCapture", () => {
  const all = ["spend", "list", "task", "timer"] as const;
  it("reads money with a dollar sign or cents, either side", () => {
    expect(guessCapture("$12 coffee", all)).toEqual({ mode: "spend", amount: "12", text: "coffee" });
    expect(guessCapture("coffee $4.50", all)).toEqual({ mode: "spend", amount: "4.50", text: "coffee" });
    expect(guessCapture("lunch 8.50", all)).toEqual({ mode: "spend", amount: "8.50", text: "lunch" });
    expect(guessCapture("$30 at Trader Joe's", all)).toEqual({ mode: "spend", amount: "30", text: "Trader Joe's" });
  });
  it("reads lists from commas or 'buy'", () => {
    expect(guessCapture("milk, eggs", all)).toEqual({ mode: "list", text: "milk, eggs" });
    expect(guessCapture("buy paper towels", all)).toEqual({ mode: "list", text: "paper towels" });
  });
  it("treats anything else as a task, and respects what the viewer has", () => {
    expect(guessCapture("2 hours of reading", all)).toEqual({ mode: "task", text: "2 hours of reading" });
    expect(guessCapture("call the dentist", ["spend", "list"])).toEqual({ mode: "list", text: "call the dentist" });
    expect(guessCapture("$12 coffee", ["list", "task"])?.mode).toBe("task");
    expect(guessCapture("   ", all)).toBeNull();
  });
});

describe("choresToOffer", () => {
  it("lists the most overdue first", () => {
    const out = choresToOffer([
      { title: "Vacuum", daysUntil: 2 },
      { title: "Trash", daysUntil: -1 },
      { title: "Dishes", daysUntil: 0 },
    ]);
    expect(out.map((t) => t.title)).toEqual(["Trash", "Dishes", "Vacuum"]);
  });
});

describe("recentTimerLabels", () => {
  it("dedupes case-insensitively and caps", () => {
    const out = recentTimerLabels(
      [
        { label: "Deep work", category: "work" },
        { label: "deep work", category: "work" },
        { label: " ", category: null },
        { label: "Reading", category: "reading" },
      ],
      5,
    );
    expect(out.map((o) => o.label)).toEqual(["Deep work", "Reading"]);
  });
});

describe("rankCategories", () => {
  it("puts the most-used spending categories first", () => {
    const out = rankCategories(
      ["Groceries", "Transport", "Shopping"],
      [
        { category: "Shopping", amount: -100 },
        { category: "shopping", amount: -100 },
        { category: "Transport", amount: -100 },
        { category: "Groceries", amount: 500 },
      ],
    );
    expect(out).toEqual(["Shopping", "Transport", "Groceries"]);
  });
});
