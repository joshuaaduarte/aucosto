import { auth } from "@/auth";
import {
  countTransactions,
  getSpendCentsSince,
} from "@/lib/services/finance";
import { WidgetCard } from "./widget-card";

function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatUSDFromCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export async function FinanceWidget() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const userId = session.user.id;
  const monthStart = startOfMonth();

  const [count, spent] = await Promise.all([
    countTransactions(userId),
    getSpendCentsSince(userId, monthStart),
  ]);

  if (count === 0) {
    return (
      <WidgetCard name="Finance" href="/app/finance">
        <div className="space-y-1">
          <p className="text-2xl font-semibold tracking-tight">No data yet</p>
          <p className="text-sm text-zinc-500">upload a CSV to start</p>
        </div>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard name="Finance" href="/app/finance">
      <div className="space-y-1">
        <p className="text-2xl font-semibold tracking-tight">
          {formatUSDFromCents(spent)}
        </p>
        <p className="text-sm text-zinc-500">spent this month</p>
      </div>
    </WidgetCard>
  );
}
