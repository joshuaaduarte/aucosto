// Log spending from an iPhone Shortcut (or anything that can POST JSON).
// No session: authenticated with a personal key made on the finance page
// (Spending → "Log from your iPhone"). Entries land in that person's finance
// space and show as theirs. See docs/finance-shortcut.md.
//
//   curl -X POST https://<host>/api/finance/entries \
//     -H "Authorization: Bearer <personal key>" \
//     -H "Content-Type: application/json" \
//     -d '{"amount":"12.50","description":"Trader Joe'\''s","category":"Groceries"}'

import { NextResponse } from "next/server";
import { runAsActor } from "@/lib/actor";
import { resolveFinanceScopeUserId } from "@/lib/household";
import { FINANCE_CATEGORIES } from "@/lib/finance-categories";
import { shortcutAmountCents, shortcutEntrySchema } from "@/lib/finance-shortcut";
import { formatUSDFromCents } from "@/lib/money";
import { addEntry, listAccounts, verifyShortcutKey } from "@/lib/services/finance";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const key = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const personUserId = key ? await verifyShortcutKey(key) : null;
  if (!personUserId) {
    return NextResponse.json(
      { ok: false, message: "That key isn't valid anymore. Make a new one on the Money page." },
      { status: 401 },
    );
  }

  const parsed = shortcutEntrySchema.safeParse(await request.json().catch(() => null));
  const amountCents = parsed.success ? shortcutAmountCents(parsed.data.amount) : null;
  if (!parsed.success || amountCents === null) {
    return NextResponse.json({ ok: false, message: "Send an amount, like 12.50." }, { status: 400 });
  }
  const body = parsed.data;

  try {
    const scopeUserId = await resolveFinanceScopeUserId(personUserId);
    const accounts = body.account ? await listAccounts(scopeUserId) : [];
    const wanted = body.account?.toLowerCase();
    const account = wanted
      ? (accounts.find((a) => a.name.toLowerCase() === wanted) ??
        accounts.find((a) => a.name.toLowerCase().includes(wanted)))
      : undefined;
    const category = (FINANCE_CATEGORIES as readonly string[]).find(
      (c) => c.toLowerCase() === body.category?.toLowerCase(),
    );
    const date = body.date ? new Date(`${body.date}T12:00:00`) : new Date();

    const entry = await runAsActor(personUserId, () =>
      addEntry(scopeUserId, {
        amountCents,
        direction: body.direction ?? "out",
        description: body.description ?? "",
        category: category ?? null,
        financeAccountId: account?.id ?? null,
        date,
        via: "shortcut",
        byUserId: personUserId,
      }),
    );
    const amount = formatUSDFromCents(Math.abs(entry.amount));
    return NextResponse.json(
      {
        ok: true,
        id: entry.id,
        message: entry.amount < 0 ? `Logged ${amount} at ${entry.description}` : `Logged ${amount} coming in`,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[api/finance/entries] failed", error);
    return NextResponse.json(
      { ok: false, message: "Could not log that. Try again, or log it in the app." },
      { status: 500 },
    );
  }
}
