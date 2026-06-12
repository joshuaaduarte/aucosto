"use client";

// "Untracked 47m — what were you doing?" One tap on a category logs the gap
// retroactively from the last entry's end to now. A small free-text field
// covers anything outside the presets. Dismiss hides it until the next gap.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { backfillEntry } from "./actions";
import type { QuickStartCategory } from "./quick-start-chips";

export function GapBackfillCard({
  gapStartIso,
  gapMinutes,
  categories,
  sinceWakeup = false,
}: {
  gapStartIso: string;
  gapMinutes: number;
  categories: QuickStartCategory[];
  /** Gap is anchored at this morning's wake time, not the last entry. */
  sinceWakeup?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dismissed, setDismissed] = useState(false);
  const [customLabel, setCustomLabel] = useState("");
  const [activeKey, setActiveKey] = useState<string | null>(null);

  if (dismissed) return null;

  const gapStart = new Date(gapStartIso);
  const hours = Math.floor(gapMinutes / 60);
  const minutes = gapMinutes % 60;
  const gapLabel = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  const log = (key: string, label: string, category?: string) => {
    if (pending) return;
    setActiveKey(key);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("label", label);
      if (category) formData.set("category", category);
      formData.set("startedAt", gapStartIso);
      formData.set("endedAt", new Date().toISOString());
      await backfillEntry(formData);
      setActiveKey(null);
      router.refresh();
    });
  };

  return (
    <article
      className="rounded-md px-5 py-4"
      style={{
        background: "var(--bg-page)",
        border: "1px dashed var(--border-soft)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className="text-[0.6875rem] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-faint)" }}
          >
            {sinceWakeup ? "Since you woke up" : "Untracked gap"}
          </p>
          <p
            className="mt-1 text-[0.9375rem] font-semibold tracking-tight"
            style={{ color: "var(--text)" }}
          >
            {sinceWakeup ? (
              <>
                No time tracked since you woke up at{" "}
                {gapStart.toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </>
            ) : (
              <>
                {gapLabel} since{" "}
                {gapStart.toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}{" "}
                — what were you doing?
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          className="btn-icon h-7 w-7 shrink-0 rounded-full border text-[0.75rem]"
          style={{ borderColor: "var(--border-faint)", color: "var(--text-faint)" }}
          onClick={() => setDismissed(true)}
          aria-label="Dismiss untracked gap"
        >
          x
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {categories.map((category) => {
          const key = `category:${category.id}`;
          return (
            <button
              key={key}
              type="button"
              disabled={pending}
              onClick={() => log(key, category.label, category.id)}
              className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-[0.75rem] font-medium transition-colors"
              style={{
                background: "var(--bg-tint)",
                color: "var(--text-muted)",
                opacity: pending && activeKey !== key ? 0.55 : 1,
              }}
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: category.color }}
                aria-hidden
              />
              {activeKey === key ? "Logging..." : category.label}
            </button>
          );
        })}
      </div>

      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const label = customLabel.trim();
          if (label) log("custom", label);
        }}
      >
        <input
          type="text"
          value={customLabel}
          onChange={(event) => setCustomLabel(event.target.value)}
          placeholder="Something else..."
          className="field"
          style={{ maxWidth: "16rem" }}
        />
        <button
          type="submit"
          disabled={pending || customLabel.trim().length === 0}
          className="btn-ghost"
        >
          {activeKey === "custom" ? "Logging..." : "Log it"}
        </button>
      </form>
    </article>
  );
}
