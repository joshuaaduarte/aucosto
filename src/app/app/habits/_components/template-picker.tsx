"use client";

// One-tap habit templates. Shown open when the user has few habits (the
// empty state IS the picker); otherwise reachable via "Browse templates".
// Already-added templates are hidden, so this list shrinks as it's used.

import { useState, useTransition } from "react";
import { categoryColor } from "@/lib/time-categories";
import {
  HABIT_TEMPLATES,
  HABIT_TEMPLATE_GROUPS,
  templateTitle,
  type HabitTemplate,
} from "@/lib/habit-templates";
import { formatHabitQuantity } from "@/lib/habits";
import { addHabitFromTemplateAction } from "../actions";

export function TemplatePicker({
  existingTitles,
  forceOpen = false,
}: {
  existingTitles: string[];
  forceOpen?: boolean;
}) {
  const [open, setOpen] = useState(forceOpen);
  const existing = new Set(existingTitles);
  const available = HABIT_TEMPLATES.filter(
    (template) => !existing.has(templateTitle(template)),
  );

  if (available.length === 0) return null;

  if (!open) {
    return (
      <div className="flex justify-end">
        <button type="button" className="btn-ghost" onClick={() => setOpen(true)}>
          Browse templates ({available.length})
        </button>
      </div>
    );
  }

  return (
    <section
      className="rounded-[1rem] border p-4 sm:p-5"
      style={{
        borderColor: "var(--border-soft)",
        background: "var(--bg-page)",
        paddingBottom:
          "calc(var(--safe-area-bottom, 0px) + var(--mobile-tabbar-height, 0px) + var(--timer-bar-height, 0px) + 3.5rem + 1rem)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className="text-[0.6875rem] font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-faint)" }}
          >
            Popular habits
          </p>
          <h2
            className="mt-1 text-[1rem] font-semibold tracking-tight"
            style={{ color: "var(--text)" }}
          >
            Add one with a single tap.
          </h2>
        </div>
        {!forceOpen ? (
          <button
            type="button"
            className="btn-icon h-8 w-8 rounded-full border"
            style={{ borderColor: "var(--border-faint)" }}
            onClick={() => setOpen(false)}
            aria-label="Close templates"
          >
            x
          </button>
        ) : null}
      </div>

      <div className="mt-4 space-y-4">
        {HABIT_TEMPLATE_GROUPS.map((group) => {
          const templates = available.filter((t) => t.group === group);
          if (templates.length === 0) return null;
          return (
            <div key={group}>
              <p
                className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-faint)" }}
              >
                {group}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {templates.map((template) => (
                  <TemplateRow key={template.key} template={template} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TemplateRow({ template }: { template: HabitTemplate }) {
  const [pending, startTransition] = useTransition();
  const [added, setAdded] = useState(false);
  const color = categoryColor(template.bucket);

  const meta = [
    template.goalUnit === "check"
      ? null
      : `${formatHabitQuantity(template.targetCount, template.goalUnit)} target`,
    template.cadence !== "daily" ? template.cadence : null,
    template.defaultDurationMinutes && template.goalUnit !== "minutes"
      ? `~${template.defaultDurationMinutes}m`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className="flex items-center gap-2.5 rounded-[0.85rem] border px-3 py-2.5"
      style={{
        borderColor: "var(--border-faint)",
        background: "var(--bg-page)",
        borderLeft: `3px solid ${color}`,
      }}
    >
      <span className="text-[1.2rem]" aria-hidden>
        {template.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.85rem] font-semibold" style={{ color: "var(--text)" }}>
          {template.title}
          {meta ? (
            <span className="ml-1.5 font-normal text-[0.7rem]" style={{ color: "var(--text-faint)" }}>
              {meta}
            </span>
          ) : null}
        </p>
        <p className="truncate text-[0.75rem]" style={{ color: "var(--text-muted)" }}>
          {template.description}
        </p>
      </div>
      <button
        type="button"
        disabled={pending || added}
        onClick={() =>
          startTransition(async () => {
            const formData = new FormData();
            formData.set("templateKey", template.key);
            await addHabitFromTemplateAction(formData);
            setAdded(true);
          })
        }
        className="btn-ink h-8 shrink-0 rounded-full px-3 text-[0.75rem]"
      >
        {added ? "Added ✓" : pending ? "Adding…" : "+ Add"}
      </button>
    </div>
  );
}
