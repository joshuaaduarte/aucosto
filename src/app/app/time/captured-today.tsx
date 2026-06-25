import {
  ensureInsightTables,
  listRecentInsights,
} from "@/lib/services/captured-insights";

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

export async function CapturedTodaySection({
  userId,
  todayStart,
}: {
  userId: string;
  todayStart: Date;
}) {
  let insights: Awaited<ReturnType<typeof listRecentInsights>> = [];
  try {
    await ensureInsightTables();
    insights = await listRecentInsights(userId, {
      limit: 10,
      since: todayStart,
    });
  } catch {
    // degrade: no insights table yet
  }

  if (insights.length === 0) return null;

  return (
    <section className="fade-in-delay-3 space-y-2">
      <p
        className="text-[0.6875rem] font-semibold uppercase tracking-wider"
        style={{ color: "var(--text-faint)" }}
      >
        Today&apos;s captures
      </p>
      <div
        className="rounded-lg"
        style={{
          background: "var(--bg-tint)",
          border: "1px solid var(--border-faint)",
        }}
      >
        {insights.map((insight) => (
          <div key={insight.id} className="flex items-start gap-3 px-4 py-3">
            <span
              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: "#f59e0b" }}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p
                className="text-[0.8125rem] leading-snug"
                style={{ color: "var(--text)" }}
              >
                {insight.text}
              </p>
              <p
                className="mt-0.5 text-[0.6875rem]"
                style={{ color: "var(--text-ghost)" }}
              >
                {insight.sourceTool} &middot; {timeAgo(insight.occurredAt)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
