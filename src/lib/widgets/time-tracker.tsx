import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatHM, startOfToday } from "@/lib/time";
import { WidgetCard } from "./widget-card";

export async function TimeTrackerWidget() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const userId = session.user.id;

  const running = await prisma.timeEntry.findFirst({
    where: { userId, endedAt: null },
    orderBy: { startedAt: "desc" },
  });

  if (running) {
    return (
      <WidgetCard name="Time tracker" href="/app/time">
        <div className="space-y-1">
          <p className="text-2xl font-semibold tracking-tight">
            {running.label}
          </p>
          <p className="text-sm text-zinc-500">
            running since{" "}
            {running.startedAt.toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        </div>
      </WidgetCard>
    );
  }

  const todayStart = startOfToday();
  const completedToday = await prisma.timeEntry.findMany({
    where: {
      userId,
      startedAt: { gte: todayStart },
      endedAt: { not: null },
    },
  });

  const totalMsToday = completedToday.reduce(
    (sum, e) => sum + (e.endedAt!.getTime() - e.startedAt.getTime()),
    0,
  );

  return (
    <WidgetCard name="Time tracker" href="/app/time">
      <div className="space-y-1">
        <p className="text-2xl font-semibold tracking-tight">
          {formatHM(totalMsToday)}
        </p>
        <p className="text-sm text-zinc-500">tracked today</p>
      </div>
    </WidgetCard>
  );
}
