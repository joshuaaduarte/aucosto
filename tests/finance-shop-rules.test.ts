import { describe, expect, it } from "vitest";
import {
  applyShopRule,
  findShopRule,
  looksLikeYourName,
  ruleFromConfirmation,
  shopRuleKey,
  type ShopRule,
} from "@/lib/finance-shop-rules";

describe("shopRuleKey", () => {
  it("gives the bank's text and your own name the same key", () => {
    expect(shopRuleKey("TRADER JOE'S #552 SAN DIEGO CA")).toBe("trader joes");
    expect(shopRuleKey("Trader Joe's")).toBe("trader joes");
  });

  it("drops card-processor prefixes and store numbers", () => {
    expect(shopRuleKey("SQ *BLUE BOTTLE COFFEE")).toBe("blue bottle");
    expect(shopRuleKey("TST* Sushi Ota 0042")).toBe("sushi ota");
    expect(shopRuleKey("AMAZON MKTPL*2K3J81")).toBe("amazon mktpl");
  });

  it("handles one-word shops and text with no words", () => {
    expect(shopRuleKey("Costco")).toBe("costco");
    expect(shopRuleKey("#1234 5678")).toBe("");
  });
});

const rule = (over: Partial<ShopRule>): ShopRule => ({
  id: "r",
  ownerUserId: "josh",
  match: "target",
  name: "Target",
  category: "Shopping",
  updatedAt: new Date("2026-11-01"),
  ...over,
});

describe("findShopRule", () => {
  const rules = [
    rule({ id: "josh", ownerUserId: "josh", category: "Shopping", updatedAt: new Date("2026-11-05") }),
    rule({ id: "ana", ownerUserId: "ana", category: "Baby", updatedAt: new Date("2026-11-01") }),
  ];

  it("prefers the acting person's own rule", () => {
    expect(findShopRule(rules, "TARGET 00012345", "ana")?.id).toBe("ana");
    expect(findShopRule(rules, "TARGET 00012345", "josh")?.id).toBe("josh");
  });

  it("falls back to the newest rule from anyone", () => {
    expect(findShopRule(rules, "Target", null)?.id).toBe("josh");
  });

  it("returns null for unknown shops", () => {
    expect(findShopRule(rules, "Shell Oil", "josh")).toBeNull();
  });
});

describe("applyShopRule", () => {
  const r = rule({ name: "Target", category: "Shopping" });

  it("renames bank text and fills the category on imports", () => {
    expect(applyShopRule({ description: "TARGET 0001", category: null }, r, { rename: true })).toEqual({
      description: "Target",
      category: "Shopping",
    });
  });

  it("keeps a category you gave and your own name when not renaming", () => {
    expect(applyShopRule({ description: "target run", category: "Home" }, r, { rename: false })).toEqual({
      description: "target run",
      category: "Home",
    });
  });
});

describe("ruleFromConfirmation", () => {
  it("learns your name and category for the bank's text", () => {
    expect(
      ruleFromConfirmation({ bankDescription: "TRADER JOE'S #552", yourDescription: "Trader Joe's", category: "Groceries" }),
    ).toEqual({ match: "trader joes", name: "Trader Joe's", category: "Groceries" });
  });

  it("learns nothing from an unsorted entry with the bank's own name", () => {
    expect(ruleFromConfirmation({ bankDescription: "SHELL", yourDescription: "shell", category: null })).toBeNull();
  });
});

describe("looksLikeYourName", () => {
  it("tells typed names from bank text", () => {
    expect(looksLikeYourName("Blue Bottle")).toBe(true);
    expect(looksLikeYourName("Trader Joe's")).toBe(true);
    expect(looksLikeYourName("SQ *BLUE BOTTLE COFFEE")).toBe(false);
    expect(looksLikeYourName("SHELL OIL 1234")).toBe(false);
    expect(looksLikeYourName("COSTCO")).toBe(false);
  });
});
