// Money / date formatting helpers shared by finance UI surfaces. Money is
// always integer minor units (cents) — divide-by-100 lives here, not in the
// view. Keep this file free of React, server-only deps, and Prisma so widgets
// and pure tests can both import it.

export function formatUSDFromCents(
  cents: number,
  options: { maximumFractionDigits?: number } = {},
): string {
  const maxDigits = options.maximumFractionDigits ?? 2;
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: maxDigits === 0 ? 0 : 2,
    maximumFractionDigits: maxDigits,
  });
}

export function formatSignedUSDFromCents(cents: number): string {
  const abs = formatUSDFromCents(Math.abs(cents));
  if (cents === 0) return abs;
  return `${cents > 0 ? "+" : "-"}${abs}`;
}

export function formatPercentDelta(
  current: number,
  previous: number,
): string | null {
  if (previous === 0) return null;
  const delta = ((current - previous) / previous) * 100;
  return `${delta > 0 ? "+" : ""}${Math.round(delta)}%`;
}

export function startOfMonth(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfPreviousMonth(date: Date = new Date()): Date {
  const d = startOfMonth(date);
  d.setMonth(d.getMonth() - 1);
  return d;
}

export function daysUntil(date: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}
