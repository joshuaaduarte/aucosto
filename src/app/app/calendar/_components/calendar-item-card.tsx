import type { CalendarItem } from "@/generated/prisma/client";
import {
  addDays,
  formatCalendarTimeRange,
  formatDateValue,
  formatTimeValue,
  calendarItemColor,
} from "../_lib/derive";
import {
  completeCalendarItemAction,
  deleteCalendarItemAction,
  moveCalendarItemAction,
  startTimerFromCalendarItemAction,
  updateCalendarBlockAction,
} from "../actions";

function CompactMoveForm({
  item,
  label,
  shiftDays = 0,
}: {
  item: CalendarItem;
  label: string;
  shiftDays?: number;
}) {
  const startsAt = addDays(item.startsAt, shiftDays);
  const endsAt = addDays(item.endsAt, shiftDays);
  return (
    <form action={moveCalendarItemAction}>
      <input type="hidden" name="id" value={item.id} />
      {/* Absolute timestamps — no wall-clock parsing on the server. */}
      <input type="hidden" name="startsAtIso" value={startsAt.toISOString()} />
      <input type="hidden" name="endsAtIso" value={endsAt.toISOString()} />
      <button className="btn-ghost h-8 px-2.5 text-[0.75rem]" type="submit">
        {label}
      </button>
    </form>
  );
}

export function CalendarItemCard({
  item,
  showAttentionActions = false,
}: {
  item: CalendarItem;
  showAttentionActions?: boolean;
}) {
  return (
    <li
      className="rounded-md p-3 sm:p-3.5"
      style={{ border: "1px solid var(--border-faint)" }}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: calendarItemColor(item) }}
              />
              <p
                className="text-[0.9375rem] font-medium"
                style={{ color: "var(--text)" }}
              >
                {item.title}
              </p>
              {item.status === "done" ? (
                <span className="pill">done</span>
              ) : null}
            </div>
            <p
              className="mt-1 text-[0.75rem]"
              style={{ color: "var(--text-faint)" }}
            >
              {formatCalendarTimeRange(item)}
              {item.location ? ` · ${item.location}` : ""}
            </p>
            {item.notes ? (
              <p
                className="mt-1.5 text-[0.8125rem]"
                style={{ color: "var(--text-muted)" }}
              >
                {item.notes}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
            {item.status !== "done" ? (
              <form action={startTimerFromCalendarItemAction}>
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="title" value={item.title} />
                <input
                  type="hidden"
                  name="doItemId"
                  value={item.sourceTool === "do" ? (item.sourceRefId ?? "") : ""}
                />
                <input
                  type="hidden"
                  name="habitId"
                  value={item.sourceTool === "habit" ? (item.sourceRefId ?? "") : ""}
                />
                <button
                  className="btn-ghost h-8 px-2.5 text-[0.75rem]"
                  type="submit"
                >
                  Start timer
                </button>
              </form>
            ) : null}
            {item.status !== "done" ? (
              <form action={completeCalendarItemAction}>
                <input type="hidden" name="id" value={item.id} />
                <button
                  className="btn-ghost h-8 px-2.5 text-[0.75rem]"
                  type="submit"
                >
                  Done
                </button>
              </form>
            ) : null}
            <form action={deleteCalendarItemAction}>
              <input type="hidden" name="id" value={item.id} />
              <button
                className="btn-ghost h-8 px-2.5 text-[0.75rem]"
                type="submit"
              >
                Delete
              </button>
            </form>
          </div>
        </div>

        {showAttentionActions ? (
          <div className="flex flex-wrap gap-2">
            <CompactMoveForm item={item} label="Later today" />
            <CompactMoveForm item={item} label="Tomorrow" shiftDays={1} />
          </div>
        ) : null}

        <details
          className="rounded-md border"
          style={{ borderColor: "var(--border-faint)" }}
        >
          <summary
            className="cursor-pointer list-none px-3 py-2 text-[0.75rem] font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            Edit or reschedule
          </summary>
          <form action={updateCalendarBlockAction} className="space-y-3 px-3 pb-3">
            <input type="hidden" name="id" value={item.id} />
            <div className="space-y-1.5">
              <label
                className="block text-[0.75rem] font-medium"
                htmlFor={`title-${item.id}`}
                style={{ color: "var(--text-muted)" }}
              >
                Title
              </label>
              <input
                id={`title-${item.id}`}
                name="title"
                defaultValue={item.title}
                required
                className="field"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label
                  className="block text-[0.75rem] font-medium"
                  htmlFor={`date-${item.id}`}
                  style={{ color: "var(--text-muted)" }}
                >
                  Date
                </label>
                <input
                  id={`date-${item.id}`}
                  name="date"
                  type="date"
                  defaultValue={formatDateValue(item.startsAt)}
                  required
                  className="field"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  className="block text-[0.75rem] font-medium"
                  htmlFor={`start-${item.id}`}
                  style={{ color: "var(--text-muted)" }}
                >
                  Start
                </label>
                <input
                  id={`start-${item.id}`}
                  name="start"
                  type="time"
                  defaultValue={formatTimeValue(item.startsAt)}
                  required
                  className="field"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  className="block text-[0.75rem] font-medium"
                  htmlFor={`end-${item.id}`}
                  style={{ color: "var(--text-muted)" }}
                >
                  End
                </label>
                <input
                  id={`end-${item.id}`}
                  name="end"
                  type="time"
                  defaultValue={formatTimeValue(item.endsAt)}
                  required
                  className="field"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  className="block text-[0.75rem] font-medium"
                  htmlFor={`location-${item.id}`}
                  style={{ color: "var(--text-muted)" }}
                >
                  Location
                </label>
                <input
                  id={`location-${item.id}`}
                  name="location"
                  defaultValue={item.location ?? ""}
                  className="field"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  className="block text-[0.75rem] font-medium"
                  htmlFor={`notes-${item.id}`}
                  style={{ color: "var(--text-muted)" }}
                >
                  Notes
                </label>
                <input
                  id={`notes-${item.id}`}
                  name="notes"
                  defaultValue={item.notes ?? ""}
                  className="field"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button type="submit" className="btn-ink">
                Save changes
              </button>
            </div>
          </form>
        </details>
      </div>
    </li>
  );
}
