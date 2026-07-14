import { getWorkTodaySnapshot } from "@/lib/services/work";
import { meetingTimeLabel } from "@/lib/work";
import { resolveActiveUserId } from "@/lib/viewer-context";
import { WidgetCard } from "./widget-card";

export async function WorkWidget() {
  const userId = await resolveActiveUserId();
  const snapshot = await getWorkTodaySnapshot(userId);

  return (
    <WidgetCard name="Work" href="/app/work">
      {!snapshot || (snapshot.meetingsToday.length === 0 && snapshot.mustDo.length === 0) ? (
        <div className="space-y-2">
          <p
            className="text-[0.9375rem] font-semibold tracking-tight"
            style={{ color: "var(--text)" }}
          >
            {snapshot ? `Nothing pressing at ${snapshot.workspaceName}.` : "Work Hub"}
          </p>
          <p className="text-[0.8125rem] leading-relaxed" style={{ color: "var(--text-muted)" }}>
            {snapshot
              ? "No meetings today and no must-do tasks."
              : "Meetings, must-dos, and the daily shutdown live here."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {snapshot.meetingsToday.length > 0 && (
            <div>
              <p
                className="text-[0.6875rem] font-medium uppercase tracking-wider"
                style={{ color: "var(--text-faint)" }}
              >
                Today&apos;s meetings
              </p>
              <ul className="mt-0.5 space-y-0.5">
                {snapshot.meetingsToday.slice(0, 3).map((meeting) => (
                  <li key={meeting.id} className="flex items-baseline gap-2">
                    <span className="tabular shrink-0 text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
                      {meetingTimeLabel(meeting.scheduledAt)}
                    </span>
                    <span className="truncate text-[0.8125rem]" style={{ color: "var(--text)" }}>
                      {meeting.title}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {snapshot.mustDo.length > 0 && (
            <div
              className={snapshot.meetingsToday.length > 0 ? "pt-2" : undefined}
              style={
                snapshot.meetingsToday.length > 0
                  ? { borderTop: "1px solid var(--border-faint)" }
                  : undefined
              }
            >
              <p
                className="text-[0.6875rem] font-medium uppercase tracking-wider"
                style={{ color: "var(--text-faint)" }}
              >
                Must do · {snapshot.workspaceName}
              </p>
              <ul className="mt-0.5 space-y-0.5">
                {snapshot.mustDo.slice(0, 3).map((task) => (
                  <li key={task.id} className="truncate text-[0.8125rem]" style={{ color: "var(--text)" }}>
                    {task.isImportant && <span style={{ color: "var(--accent)" }}>★ </span>}
                    {task.title}
                  </li>
                ))}
              </ul>
              {snapshot.mustDo.length > 3 && (
                <p className="mt-0.5 text-[0.6875rem]" style={{ color: "var(--text-faint)" }}>
                  +{snapshot.mustDo.length - 3} more
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </WidgetCard>
  );
}
