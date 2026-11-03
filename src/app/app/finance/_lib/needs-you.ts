// Builds the Overview's "Needs you" list from the tracking + planning views:
// only things you can act on, most urgent first. Pure; tested in
// tests/finance-needs-you.test.ts.

export type NeedsYouItem =
  | { kind: "sort"; count: number }
  | { kind: "card"; id: string; name: string; amountCents: number; daysUntil: number; fromAccountId: string | null }
  | { kind: "short"; cents: number }
  | { kind: "statement"; id: string; name: string }
  | { kind: "bill"; id: string; name: string; amountCents: number | null; daysUntil: number; autopay: boolean }
  | { kind: "balances"; count: number }
  | { kind: "checkin"; done: boolean };


export type NeedsYouInput = {
  toSortCount: number;
  cards: Array<{
    id: string;
    name: string;
    statementBalanceCents: number | null;
    daysUntil: number | null;
    waitingForStatement: boolean;
  }>;
  payFromAccountId: string | null;
  safeShortCents: number;
  statementsDue: Array<{ id: string; name: string }>;
  bills: Array<{ id: string; name: string; amountCents: number | null; daysUntil: number; autopay: boolean }>;
  balancesToUpdate: number;
  checkInDone: boolean;
  now: Date;
};

/** Cards show up this many days before they're due. */
export const CARD_WINDOW_DAYS = 10;
/** Bills (rent, utilities) show up this many days before they're due. */
export const BILL_WINDOW_DAYS = 7;

export function buildNeedsYou(input: NeedsYouInput): NeedsYouItem[] {
  const urgent: NeedsYouItem[] = [];
  const rest: NeedsYouItem[] = [];

  if (input.safeShortCents > 0) urgent.push({ kind: "short", cents: input.safeShortCents });

  const cards = input.cards
    .filter(
      (c) =>
        !c.waitingForStatement &&
        c.daysUntil !== null &&
        c.daysUntil <= CARD_WINDOW_DAYS &&
        (c.statementBalanceCents ?? 0) > 0,
    )
    .sort((a, b) => a.daysUntil! - b.daysUntil!);
  for (const c of cards) {
    const item: NeedsYouItem = {
      kind: "card",
      id: c.id,
      name: c.name,
      amountCents: c.statementBalanceCents ?? 0,
      daysUntil: c.daysUntil!,
      fromAccountId: input.payFromAccountId,
    };
    (c.daysUntil! <= 3 ? urgent : rest).push(item);
  }

  if (input.toSortCount > 0) urgent.push({ kind: "sort", count: input.toSortCount });

  // Autopay bills look after themselves; only manual ones need you.
  for (const b of input.bills
    .filter((b) => !b.autopay && b.daysUntil <= BILL_WINDOW_DAYS)
    .sort((a, b) => a.daysUntil - b.daysUntil)) {
    (b.daysUntil <= 1 ? urgent : rest).push({ kind: "bill", ...b });
  }

  for (const s of input.statementsDue) rest.push({ kind: "statement", id: s.id, name: s.name });
  if (input.balancesToUpdate > 0) rest.push({ kind: "balances", count: input.balancesToUpdate });

  // The weekly check-in only nags from Friday through Sunday.
  const day = input.now.getDay();
  if (!input.checkInDone && (day === 5 || day === 6 || day === 0)) rest.push({ kind: "checkin", done: false });

  return [...urgent, ...rest];
}
