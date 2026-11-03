import { describe, expect, it } from "vitest";
import { buildSortQueue, needsSorting, sameShopIds, type SortTx } from "@/lib/finance-sort";

function tx(partial: Partial<SortTx> & { id: string }): SortTx {
  return {
    date: new Date(2026, 9, 1),
    amount: -1000,
    description: "Shop",
    category: null,
    financeAccountId: null,
    raw: null,
    externalId: null,
    ...partial,
  };
}

describe("needsSorting", () => {
  it("only spending without a category", () => {
    expect(needsSorting(tx({ id: "a" }))).toBe(true);
    expect(needsSorting(tx({ id: "b", category: "Groceries" }))).toBe(false);
    expect(needsSorting(tx({ id: "c", amount: 500 }))).toBe(false);
  });
});

describe("buildSortQueue", () => {
  const history: SortTx[] = [
    tx({ id: "old-shell", description: "Shell", category: "Transport", date: new Date(2026, 8, 1) }),
    tx({ id: "s1", description: "Shell", date: new Date(2026, 9, 3), financeAccountId: "chk" }),
    tx({ id: "s2", description: "shell ", date: new Date(2026, 9, 1) }),
    tx({ id: "n1", description: "Netflix", date: new Date(2026, 9, 2) }),
    tx({ id: "z1", description: "Zzz unknown", date: new Date(2026, 9, 4) }),
  ];
  const queue = buildSortQueue({ history, accountNames: { chk: "Chase" }, names: {} });

  it("lists unsorted entries oldest first", () => {
    expect(queue.map((q) => q.id)).toEqual(["s2", "n1", "s1", "z1"]);
  });

  it("suggests the shop's last category, then a guess from the name", () => {
    expect(queue.find((q) => q.id === "s1")?.suggestion).toBe("Transport");
    expect(queue.find((q) => q.id === "n1")?.suggestion).toBe("Subscriptions");
    expect(queue.find((q) => q.id === "z1")?.suggestion).toBeNull();
  });

  it("counts entries from the same shop and finds them", () => {
    const s1 = queue.find((q) => q.id === "s1")!;
    expect(s1.sameShop).toBe(2);
    expect(s1.accountName).toBe("Chase");
    expect(sameShopIds(queue, s1)).toEqual(["s2"]);
  });
});
