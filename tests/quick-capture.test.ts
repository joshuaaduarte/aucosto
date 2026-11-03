import { describe, expect, it } from "vitest";
import {
  applyKeypadKey,
  captureModes,
  financeCategoryLook,
  formatTypedAmount,
  initialCaptureMode,
  rankCategories,
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

describe("captureModes", () => {
  it("gives partners money and lists only", () => {
    expect(captureModes({ financeVisible: true, isPartner: true })).toEqual(["spend", "list"]);
  });
  it("hides money when finance is hidden", () => {
    expect(captureModes({ financeVisible: false, isPartner: false })).toEqual(["list", "task", "timer"]);
  });
  it("falls back to the first mode", () => {
    expect(initialCaptureMode(["spend", "list"], "timer")).toBe("spend");
    expect(initialCaptureMode(["spend", "list"], "list")).toBe("list");
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
