import { formatMinutes } from "@/lib/do";
import { listSuggestedDoItems } from "@/lib/services/do";
import { resolveActiveUserId } from "@/lib/viewer-context";
import { WidgetCard } from "./widget-card";

export async function DoWidget() {
  const userId = await resolveActiveUserId();
  const items = await listSuggestedDoItems(userId, { limit: 3 });
  const next = items[0] ?? null;

  return (
    <WidgetCard name="Do List" href="/app/do">
      {!next ? (
        <div className="space-y-2">
          <p
            className="text-[0.9375rem] font-semibold tracking-tight"
            style={{ color: "var(--text)" }}
          >
            Nothing captured yet.
          </p>
          <p
            className="text-[0.8125rem] leading-relaxed"
            style={{ color: "var(--text-muted)" }}
          >
            Add one task and the timer and calendar can start helping.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <p
              className="text-[0.6875rem] font-medium uppercase tracking-wider"
              style={{ color: "var(--text-faint)" }}
            >
              Suggested next
            </p>
            <p
              className="mt-0.5 text-[1rem] font-semibold tracking-tight"
              style={{ color: "var(--text)" }}
            >
              {next.title}
            </p>
            <p
              className="mt-0.5 text-[0.75rem]"
              style={{ color: "var(--text-muted)" }}
            >
              {formatMinutes(next.estimatedMinutes)} planned
            </p>
          </div>

          {items.length > 1 ? (
            <ol
              className="space-y-1.5 pt-2"
              style={{ borderTop: "1px solid var(--border-faint)" }}
            >
              {items.slice(1).map((item) => (
                <li key={item.id} className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[0.8125rem]" style={{ color: "var(--text)" }}>
                    {item.title}
                  </span>
                  <span className="shrink-0 text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
                    {formatMinutes(item.estimatedMinutes)}
                  </span>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      )}
    </WidgetCard>
  );
}
