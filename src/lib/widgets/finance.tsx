import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { WidgetCard } from "./widget-card";

function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatUSD(n: number): string {
  return n.toLocaleString("en-US", {
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

  const [count, monthAgg] = await Promise.all([
    prisma.transaction.count({ where: { userId } }),
    prisma.transaction.aggregate({
      where: { userId, date: { gte: monthStart }, amount: { lt: 0 } },
      _sum: { amount: true },
    }),
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

  const spent = Math.abs(monthAgg._sum.amount ?? 0);

  return (
    <WidgetCard name="Finance" href="/app/finance">
      <div className="space-y-1">
        <p className="text-2xl font-semibold tracking-tight">
          {formatUSD(spent)}
        </p>
        <p className="text-sm text-zinc-500">spent this month</p>
      </div>
    </WidgetCard>
  );
}
