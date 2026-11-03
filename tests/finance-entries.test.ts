import { describe, expect, it } from "vitest";
import {
  encodeEntryMeta,
  entryStatus,
  filterMerchants,
  initials,
  lastUsedAccountId,
  merchantSuggestions,
  parseAmountInput,
  readEntryMeta,
} from "@/lib/finance-entries";

const d = (s: string) => new Date(`${s}T12:00:00`);

describe("entry status", () => {
  it("maps postedStatus to plain states", () => {
    expect(entryStatus({ postedStatus: "pending" })).toBe("pending");
    expect(entryStatus({ postedStatus: "reconciled" })).toBe("locked");
    expect(entryStatus({ postedStatus: "cleared" })).toBe("confirmed");
    expect(entryStatus({ postedStatus: null })).toBe("confirmed");
  });
});

describe("entry meta", () => {
  it("round-trips and ignores imported raw text", () => {
    expect(readEntryMeta(encodeEntryMeta({ by: "u1", via: "shortcut" }))).toEqual({ by: "u1", via: "shortcut" });
    expect(readEntryMeta('{"date":"2026-01-01","amount":"-5"}')).toEqual({});
    expect(readEntryMeta("01/02/2026,Coffee,-5.00")).toEqual({});
    expect(readEntryMeta("{broken")).toEqual({});
    expect(readEntryMeta(null)).toEqual({});
  });
});

describe("parseAmountInput", () => {
  it("accepts common typing", () => {
    expect(parseAmountInput("12")).toBe(1200);
    expect(parseAmountInput("12.5")).toBe(1250);
    expect(parseAmountInput("$1,200.99")).toBe(120099);
    expect(parseAmountInput(".75")).toBe(75);
  });
  it("rejects nonsense and zero", () => {
    expect(parseAmountInput("")).toBeNull();
    expect(parseAmountInput("0")).toBeNull();
    expect(parseAmountInput("abc")).toBeNull();
    expect(parseAmountInput("1.234")).toBeNull();
    expect(parseAmountInput("-5")).toBeNull();
  });
});

describe("initials", () => {
  it("takes first and last", () => {
    expect(initials("Josh Duarte")).toBe("JD");
    expect(initials("ana")).toBe("A");
    expect(initials("  ")).toBe("");
  });
});

describe("merchant memory", () => {
  const history = [
    { description: "Trader Joe's", category: "Groceries", financeAccountId: "a1", amount: -4500, date: d("2026-10-01") },
    { description: "trader joe's", category: "Groceries", financeAccountId: "a2", amount: -3000, date: d("2026-10-20") },
    { description: "Target", category: "Shopping", financeAccountId: "a1", amount: -2000, date: d("2026-10-10") },
    { description: "Paycheck", category: "Income", financeAccountId: "a1", amount: 500000, date: d("2026-10-15") },
  ];
  it("keeps the latest version of each merchant, outflows only", () => {
    const list = merchantSuggestions(history);
    expect(list.map((m) => m.description)).toEqual(["trader joe's", "Target"]);
    expect(list[0]).toMatchObject({ financeAccountId: "a2", amountCents: 3000 });
  });
  it("filters by prefix first", () => {
    const list = merchantSuggestions(history);
    expect(filterMerchants(list, "tar").map((m) => m.description)).toEqual(["Target"]);
    expect(filterMerchants(list, "joe").map((m) => m.description)).toEqual(["trader joe's"]);
    expect(filterMerchants(list, "")).toEqual([]);
  });
  it("finds the last account a person used", () => {
    const rows = [
      { financeAccountId: "a1", raw: encodeEntryMeta({ by: "u1" }), date: d("2026-10-01") },
      { financeAccountId: "a2", raw: encodeEntryMeta({ by: "u1" }), date: d("2026-10-05") },
      { financeAccountId: "a3", raw: encodeEntryMeta({ by: "u2" }), date: d("2026-10-09") },
    ];
    expect(lastUsedAccountId(rows, "u1")).toBe("a2");
    expect(lastUsedAccountId(rows, "nobody")).toBeNull();
  });
});
