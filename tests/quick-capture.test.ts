import { describe, expect, it } from "vitest";
import {
  applyKeypadKey,
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
