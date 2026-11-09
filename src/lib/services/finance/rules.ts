// Remembered shop rules (src/lib/finance-shop-rules.ts holds the matching).
// Scope userId is the finance scope; each rule also names the person who
// made it. The table comes from scripts/create-finance-shop-rules.sql: until
// it runs, reads return no rules and saves are skipped, so finance works as
// before.

import "server-only";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/auth/can";
import { currentActorUserId } from "@/lib/actor";
import { recordEvent } from "@/lib/services/events";
import { isMissingHouseholdTable } from "@/lib/household";
import { normalizeCategory } from "@/lib/finance-categories";
import { shopRuleKey, type ShopRule } from "@/lib/finance-shop-rules";

function quiet<T>(label: string, fallback: T) {
  return (error: unknown): T => {
    if (!isMissingHouseholdTable(error)) console.error(`[finance] ${label} failed`, error);
    return fallback;
  };
}

export async function listShopRules(userId: string): Promise<ShopRule[]> {
  requireCan(userId, "finance", "read");
  return prisma.financeShopRule
    .findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: { id: true, ownerUserId: true, match: true, name: true, category: true, updatedAt: true },
    })
    .catch(quiet("list shop rules", [] as ShopRule[]));
}

export type SaveShopRuleInput = {
  /** Any text from the shop (bank text or your own); the key is derived from it. */
  description: string;
  name?: string | null;
  category?: string | null;
  /** Defaults to the acting person. */
  ownerUserId?: string | null;
};

/**
 * Remember a shop's name and/or category for one person. Fields left out
 * keep what the rule had. Returns null when nothing was saved.
 */
export async function saveShopRule(userId: string, input: SaveShopRuleInput): Promise<ShopRule | null> {
  requireCan(userId, "finance", "write");
  const match = shopRuleKey(input.description);
  const ownerUserId = input.ownerUserId ?? currentActorUserId() ?? userId;
  if (!match) return null;
  const category = input.category === undefined ? undefined : normalizeCategory(input.category);
  const name = input.name === undefined ? undefined : input.name?.trim().slice(0, 120) || null;
  if (category === undefined && name === undefined) return null;
  const rule = await prisma.financeShopRule
    .upsert({
      where: { userId_ownerUserId_match: { userId, ownerUserId, match } },
      create: { userId, ownerUserId, match, name: name ?? null, category: category ?? null },
      update: { ...(name !== undefined ? { name } : {}), ...(category !== undefined ? { category } : {}) },
      select: { id: true, ownerUserId: true, match: true, name: true, category: true, updatedAt: true },
    })
    .catch(quiet("save shop rule", null));
  if (rule) {
    await recordEvent({
      userId,
      tool: "finance",
      type: "finance.rule_saved",
      refId: rule.id,
      meta: { match, category: rule.category, name: rule.name },
    });
  }
  return rule;
}

export async function deleteShopRule(userId: string, id: string): Promise<void> {
  requireCan(userId, "finance", "write");
  const { count } = await prisma.financeShopRule.deleteMany({ where: { id, userId } });
  if (count > 0) {
    await recordEvent({ userId, tool: "finance", type: "finance.rule_removed", refId: id });
  }
}
