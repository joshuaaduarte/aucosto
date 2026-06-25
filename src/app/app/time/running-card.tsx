"use client";

import { cloneElement, isValidElement, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatMinutes } from "@/lib/do";
import { MentionTextarea } from "@/components/mention-textarea";
import {
  stopEntry,
  stopEntryAndCompleteDoItem,
  stopEntryWithHabitReflection,
  stopEntryWithReflection,
  switchEntryWithHabitReflection,
} from "./actions";
import { formatDuration } from "@/lib/time";
import { DescribeRow } from "./describe-row";
import { RunningNotes } from "./running-notes";
import {
  BackdatedStopModal,
  ClockRewindIcon,
} from "./backdated-stop-modal";
import type { StartPayload } from "./quick-start-chips";
import { useBodyScrollLock } from "../_components/use-body-scroll-lock";

export function RunningCard({
  entryId,
  label,
  category,
  startedAtIso,
  notes = null,
  doItem,
  habit,
  switchPanel,
  recentLabels = [],
}: {
  entryId: string;
  label: string;
  category: string | null;
  startedAtIso: string;
  notes?: string | null;
  switchPanel?: React.ReactNode;
  recentLabels?: string[];
  doItem?: {
    id: string;
    title: string;
    estimatedMinutes: number | null;
    trackedMinutes: number;
  } | null;
  habit?: {
    id: string;
    title: string;
    targetLabel: string;
    goalUnit: string;
    suggestedQuantity: number;
  } | null;
}) {
  const router = useRouter();
  const startedAt = new Date(startedAtIso).getTime();
  const [now, setNow] = useState(() => Date.now());
  const [pending, startTransition] = useTransition();
  const [reflectOpen, setReflectOpen] = useState(false);
  const [stopAtOpen, setStopAtOpen] = useState(false);
  const [switchPayload, setSwitchPayload] = useState<StartPayload | null>(null);
  useBodyScrollLock(reflectOpen);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsedMinutes = Math.max(
    5,
    Math.round((now - startedAt) / 60000 / 5) * 5,
  );
  const trackedIfStoppedNow = (doItem?.trackedMinutes ?? 0) + elapsedMinutes;
  const [reflectionPending, startReflectionTransition] = useTransition();
  const isMinuteHabit = habit?.goalUnit === "minutes";

  const closeHabitModal = () => {
    setReflectOpen(false);
    setSwitchPayload(null);
  };

  // Check/count habits need an explicit log before switching away — route
  // switch-panel taps through the same modal used by "Log and stop".
  const switchPanelNode =
    switchPanel && habit && isValidElement(switchPanel)
      ? cloneElement(
          switchPanel as React.ReactElement<{
            runningHabit?: { id: string; isMinuteHabit: boolean } | null;
            onSwitchHabitLogRequired?: (payload: StartPayload) => void;
          }>,
          {
            runningHabit: { id: habit.id, isMinuteHabit },
            onSwitchHabitLogRequired: (payload: StartPayload) => {
              setSwitchPayload(payload);
              setReflectOpen(true);
            },
          },
        )
      : switchPanel;

  return (
    <>
      <article
        className="rounded-md px-5 py-5"
        style={{
          background: "var(--accent-tint)",
          border: "1px solid var(--accent-tint-strong)",
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="ink-pulse inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--accent)" }}
                aria-hidden
              />
              <span
                className="whitespace-nowrap text-[0.6875rem] font-semibold uppercase tracking-wider"
                style={{ color: "var(--accent-strong)" }}
              >
                Running{category ? ` · ${category}` : ""}
              </span>
            </div>
            <h2
              className="mt-2 truncate text-[1.5rem] font-bold tracking-tight sm:text-[1.875rem]"
              style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
            >
              {label}
            </h2>
            <p
              className="mt-1 whitespace-nowrap text-[2.5rem] font-semibold tabular leading-none sm:text-[3.25rem]"
              style={{
                color: "var(--text)",
                letterSpacing: "-0.03em",
                fontFeatureSettings: '"tnum" 1',
              }}
            >
              {formatDuration(now - startedAt)}
            </p>
            {doItem ? (
              <p
                className="mt-2 text-[0.8125rem]"
                style={{ color: "var(--text-muted)" }}
              >
                Linked to Do List: {doItem.title}
              </p>
            ) : null}
            {doItem ? (
              <p
                className="mt-1 text-[0.75rem]"
                style={{ color: "var(--text-faint)" }}
              >
                {`Tracked if you stop now: ${formatMinutes(trackedIfStoppedNow)}`}
                {doItem.estimatedMinutes
                  ? ` · estimate ${formatMinutes(doItem.estimatedMinutes)}`
                  : ""}
              </p>
            ) : null}
            {!doItem && habit ? (
              <p
                className="mt-2 text-[0.75rem]"
                style={{ color: "var(--text-faint)" }}
              >
                {isMinuteHabit
                  ? `Tracked if you stop now: ${formatMinutes(elapsedMinutes)} · target ${habit.targetLabel}`
                  : `Habit · ${habit.targetLabel}`}
              </p>
            ) : null}
            {!doItem && !habit ? (
              <DescribeRow
                entryId={entryId}
                currentLabel={label}
                recentLabels={recentLabels}
              />
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {/* Secondary stop: end this entry at an earlier time. A quiet icon
                so the primary stop actions stay front and center. */}
            <button
              type="button"
              onClick={() => setStopAtOpen(true)}
              disabled={pending}
              aria-label="Stop at an earlier time"
              title="Stop at an earlier time"
              className="btn-icon h-9 w-9 rounded-full border"
              style={{
                borderColor: "var(--border-faint)",
                color: "var(--text-muted)",
              }}
            >
              <ClockRewindIcon />
            </button>
            {doItem ? (
              <>
                <form action={stopEntryAndCompleteDoItem}>
                  <input type="hidden" name="doItemId" value={doItem.id} />
                  <input type="hidden" name="actualMinutes" value={trackedIfStoppedNow} />
                  <button type="submit" className="btn-ink">
                    Done and stop
                  </button>
                </form>
                <button
                  type="button"
                  onClick={() => setReflectOpen(true)}
                  className="btn-ghost"
                >
                  Stop and reflect
                </button>
              </>
            ) : habit ? (
              <>
                {!isMinuteHabit ? (
                  <button
                    type="button"
                    onClick={() => setReflectOpen(true)}
                    className="btn-ink"
                  >
                    Log and stop
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() =>
                    startTransition(async () => {
                      await stopEntry();
                      router.refresh();
                    })
                  }
                  disabled={pending}
                  className="btn-ghost"
                >
                  {pending
                    ? "Stopping..."
                    : isMinuteHabit
                      ? "Stop and keep progress"
                      : "Stop only"}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() =>
                  startTransition(async () => {
                    await stopEntry();
                    router.refresh();
                  })
                }
                disabled={pending}
                className="btn-ghost"
              >
                {pending ? "Stopping..." : "Stop"}
              </button>
            )}
          </div>
        </div>

        {/* Jot notes mid-session — keyed by entry so a switch starts fresh. */}
        <RunningNotes key={entryId} entryId={entryId} initialNotes={notes} />

        {switchPanelNode ? (
          <div
            className="mt-5 border-t pt-4"
            style={{ borderColor: "var(--accent-tint-strong)" }}
          >
            <p
              className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-wider"
              style={{ color: "var(--accent-strong)" }}
            >
              Switch — one tap stops this and starts the next
            </p>
            {switchPanelNode}
          </div>
        ) : null}
      </article>

      {reflectOpen && doItem ? (
        <div
          className="calendar-modal-backdrop"
          role="presentation"
          onClick={() => setReflectOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="time-reflection-title"
            className="calendar-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p
                  className="text-[0.6875rem] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-faint)" }}
                >
                  Stop session
                </p>
                <h2
                  id="time-reflection-title"
                  className="mt-1 text-[1.125rem] font-semibold tracking-tight"
                  style={{ color: "var(--text)" }}
                >
                  Close the loop on {doItem.title}
                </h2>
              </div>

              <button
                type="button"
                className="btn-icon h-8 w-8 rounded-full border"
                style={{ borderColor: "var(--border-faint)" }}
                onClick={() => setReflectOpen(false)}
                aria-label="Close reflection modal"
              >
                ×
              </button>
            </div>

            <form
              action={(formData) => {
                startReflectionTransition(async () => {
                  await stopEntryWithReflection(formData);
                  router.refresh();
                  setReflectOpen(false);
                });
              }}
              className="mt-5 space-y-4"
            >
              <input type="hidden" name="doItemId" value={doItem.id} />

              <div className="space-y-1.5">
                <label
                  className="block text-[0.75rem] font-medium"
                  style={{ color: "var(--text-muted)" }}
                  htmlFor="reflection-outcome"
                >
                  What should happen next?
                </label>
                <select
                  id="reflection-outcome"
                  name="outcome"
                  defaultValue="continue"
                  className="field"
                >
                  <option value="continue">Keep going later</option>
                  <option value="done">Mark it done</option>
                  <option value="waiting">Move it to waiting</option>
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    className="block text-[0.75rem] font-medium"
                    style={{ color: "var(--text-muted)" }}
                  htmlFor="reflection-actual"
                >
                    Final actual minutes
                  </label>
                  <input
                    id="reflection-actual"
                    name="actualMinutes"
                    type="number"
                    min={5}
                    step={5}
                    defaultValue={trackedIfStoppedNow}
                    className="field"
                  />
                  <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
                    Only used if you mark this task done.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label
                    className="block text-[0.75rem] font-medium"
                    style={{ color: "var(--text-muted)" }}
                    htmlFor="reflection-remaining"
                  >
                    Minutes left
                  </label>
                  <input
                    id="reflection-remaining"
                    name="remainingMinutes"
                    type="number"
                    min={5}
                    step={5}
                    placeholder="Optional"
                    className="field"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  className="block text-[0.75rem] font-medium"
                  style={{ color: "var(--text-muted)" }}
                  htmlFor="reflection-notes"
                >
                  Notes
                </label>
                <MentionTextarea
                  id="reflection-notes"
                  name="notes"
                  rows={2}
                  className="field min-h-[64px] resize-y"
                  placeholder="Anything to remember for next time?"
                  helperText="Type @ to link a Rolodex person."
                />
              </div>

              <div
                className="sticky bottom-0 -mx-4 mt-2 flex items-center justify-between gap-3 border-t px-4 pb-1 pt-3 sm:-mx-5 sm:px-5"
                style={{
                  background: "var(--bg-page)",
                  borderColor: "var(--border-faint)",
                }}
              >
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={reflectionPending}
                  onClick={() => setReflectOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" disabled={reflectionPending} className="btn-ink">
                  {reflectionPending ? "Stopping..." : "Stop session"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {reflectOpen && !doItem && habit && !isMinuteHabit ? (
        <div
          className="calendar-modal-backdrop"
          role="presentation"
          onClick={closeHabitModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="habit-reflection-title"
            className="calendar-modal"
            style={{
              paddingBottom:
                "calc(1rem + var(--mobile-tabbar-height, 0px) + var(--timer-bar-height, 0px) + var(--safe-area-bottom, 0px))",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p
                  className="text-[0.6875rem] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-faint)" }}
                >
                  {switchPayload ? "Switching" : "Stop session"}
                </p>
                <h2
                  id="habit-reflection-title"
                  className="mt-1 text-[1.125rem] font-semibold tracking-tight"
                  style={{ color: "var(--text)" }}
                >
                  Count this habit session
                </h2>
                <p
                  className="mt-2 text-[0.8125rem]"
                  style={{ color: "var(--text-muted)" }}
                >
                  {switchPayload
                    ? `Log this before switching to "${switchPayload.label}" — timed check/count habits need an explicit log so the habit gets credit.`
                    : "Timed habit sessions for check/count habits need an explicit log so the habit gets credit."}
                </p>
              </div>

              <button
                type="button"
                className="btn-icon h-8 w-8 rounded-full border"
                style={{ borderColor: "var(--border-faint)" }}
                onClick={closeHabitModal}
                aria-label="Close habit reflection modal"
              >
                ×
              </button>
            </div>

            <form
              action={(formData) => {
                startReflectionTransition(async () => {
                  if (switchPayload) {
                    formData.set("nextLabel", switchPayload.label);
                    if (switchPayload.category) formData.set("nextCategory", switchPayload.category);
                    if (switchPayload.doItemId) formData.set("nextDoItemId", switchPayload.doItemId);
                    if (switchPayload.habitId) formData.set("nextHabitId", switchPayload.habitId);
                    if (switchPayload.projectId) formData.set("nextProjectId", switchPayload.projectId);
                    await switchEntryWithHabitReflection(formData);
                  } else {
                    await stopEntryWithHabitReflection(formData);
                  }
                  router.refresh();
                  closeHabitModal();
                });
              }}
              className="mt-5 space-y-4"
            >
              <input type="hidden" name="habitId" value={habit.id} />

              <div className="space-y-1.5">
                <label
                  className="block text-[0.75rem] font-medium"
                  style={{ color: "var(--text-muted)" }}
                  htmlFor="habit-reflection-quantity"
                >
                  Quantity to log
                </label>
                <input
                  id="habit-reflection-quantity"
                  name="quantity"
                  type="number"
                  min={1}
                  step={1}
                  defaultValue={habit.suggestedQuantity}
                  className="field"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  className="block text-[0.75rem] font-medium"
                  style={{ color: "var(--text-muted)" }}
                  htmlFor="habit-reflection-notes"
                >
                  Notes
                </label>
                <MentionTextarea
                  id="habit-reflection-notes"
                  name="notes"
                  rows={2}
                  className="field min-h-[64px] resize-y"
                  placeholder="What did you finish or learn?"
                  helperText="Type @ to link a Rolodex person."
                />
              </div>

              <div
                className="sticky bottom-0 -mx-4 mt-2 flex items-center justify-between gap-3 border-t px-4 pb-1 pt-3 sm:-mx-5 sm:px-5"
                style={{
                  background: "var(--bg-page)",
                  borderColor: "var(--border-faint)",
                }}
              >
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={reflectionPending}
                  onClick={closeHabitModal}
                >
                  Cancel
                </button>
                <button type="submit" disabled={reflectionPending} className="btn-ink">
                  {reflectionPending
                    ? switchPayload
                      ? "Switching..."
                      : "Stopping..."
                    : switchPayload
                      ? "Log and switch"
                      : "Log and stop"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {stopAtOpen ? (
        <BackdatedStopModal
          startedAtIso={startedAtIso}
          onClose={() => setStopAtOpen(false)}
          onStopped={() => {
            setStopAtOpen(false);
            // Already on /app/time — refreshing surfaces the gap-backfill card
            // for the stretch between the backdated stop and now.
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}
