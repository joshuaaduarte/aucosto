"use client";

import { useState, useTransition } from "react";
import type { ProjectPlan } from "@/lib/services/project-planning";
import { MentionTextarea } from "@/components/mention-textarea";
import {
  updateProjectPlanAction,
  addProjectQuestionAction,
  addProjectBlockerAction,
  removeProjectQuestionAction,
  removeProjectBlockerAction,
  setNextActionAction,
} from "../plan-actions";

// ── Inline text edit ──────────────────────────────────────────────────────

function InlineEdit({
  value,
  placeholder,
  multiline,
  onSave,
}: {
  value: string | null;
  placeholder: string;
  multiline?: boolean;
  onSave: (val: string | null) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [pending, start] = useTransition();

  function handleSave() {
    const trimmed = draft.trim() || null;
    start(async () => {
      await onSave(trimmed);
      setEditing(false);
    });
  }

  function handleCancel() {
    setDraft(value ?? "");
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => { setDraft(value ?? ""); setEditing(true); }}
        className="w-full rounded px-2 py-1.5 text-left text-[0.875rem] transition-colors hover:bg-bg-hover"
        style={{ color: value ? "var(--text)" : "var(--text-ghost)", minHeight: "2rem" }}
      >
        {value || placeholder}
      </button>
    );
  }

  return (
    <div className="space-y-1.5">
      {multiline ? (
        <MentionTextarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          className="field w-full resize-none text-[0.875rem]"
          placeholder={placeholder}
          helperText="Type @ to link a Rolodex person."
        />
      ) : (
        <input
          autoFocus
          type="text"
          enterKeyHint="done"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); handleSave(); }
            if (e.key === "Escape") handleCancel();
          }}
          className="field w-full text-[0.875rem]"
          placeholder={placeholder}
        />
      )}
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="btn-ghost px-2.5 py-1 text-[0.8125rem] font-medium"
          style={{ color: "var(--accent)" }}
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="btn-ghost px-2.5 py-1 text-[0.8125rem]"
          style={{ color: "var(--text-muted)" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Array field (questions/blockers) ─────────────────────────────────────

function ArrayField({
  label,
  items,
  placeholder,
  onAdd,
  onRemove,
}: {
  label: string;
  items: string[];
  placeholder: string;
  onAdd: (val: string) => Promise<void>;
  onRemove: (val: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [pending, start] = useTransition();

  function handleAdd() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    start(async () => {
      await onAdd(trimmed);
      setDraft("");
    });
  }

  return (
    <div className="space-y-1.5">
      {items.length === 0 && (
        <p className="px-2 text-[0.8125rem]" style={{ color: "var(--text-ghost)" }}>
          None
        </p>
      )}
      {items.map((item) => (
        <div key={item} className="flex items-start gap-1.5">
          <span
            className="mt-0.5 shrink-0 text-[0.75rem]"
            style={{ color: "var(--text-muted)" }}
            aria-hidden
          >
            {label === "Open questions" ? "?" : "⚠"}
          </span>
          <span className="flex-1 text-[0.875rem]" style={{ color: "var(--text)" }}>
            {item}
          </span>
          <button
            type="button"
            onClick={() => start(() => onRemove(item))}
            disabled={pending}
            className="btn-icon shrink-0 text-[0.75rem]"
            style={{ color: "var(--text-ghost)" }}
            aria-label={`Remove: ${item}`}
          >
            ×
          </button>
        </div>
      ))}
      <div className="flex gap-1.5">
        <MentionTextarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); handleAdd(); }
          }}
          placeholder={placeholder}
          rows={1}
          className="field min-h-[2.25rem] flex-1 resize-none text-[0.8125rem]"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={pending || !draft.trim()}
          className="btn-ghost px-2.5 py-1 text-[0.8125rem] font-medium"
          style={{ color: "var(--accent)" }}
        >
          Add
        </button>
      </div>
    </div>
  );
}

// ── Planning field row ────────────────────────────────────────────────────

function PlanRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-lg px-3 py-2.5"
      style={{ background: "var(--bg-tint)", border: "1px solid var(--border-faint)" }}
    >
      <p
        className="mb-1 text-[0.6875rem] font-semibold uppercase tracking-wider"
        style={{ color: "var(--text-faint)" }}
      >
        {label}
      </p>
      {children}
    </div>
  );
}

// ── Public component ──────────────────────────────────────────────────────

export function ProjectPlanSection({
  projectId,
  plan,
}: {
  projectId: string;
  plan: ProjectPlan;
}) {
  const missingNextAction = !plan.nextAction;

  return (
    <section className="space-y-3">
      <h2
        className="text-[0.6875rem] font-semibold uppercase tracking-wider"
        style={{ color: "var(--text-faint)" }}
      >
        Planning
      </h2>

      {/* Next Action — prominent */}
      <div
        className="rounded-lg px-3 py-3"
        style={{
          background: missingNextAction ? "var(--accent-tint)" : "var(--bg-tint)",
          border: `1px solid ${missingNextAction ? "var(--accent-soft)" : "var(--border-faint)"}`,
        }}
      >
        <p
          className="mb-1 flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider"
          style={{ color: missingNextAction ? "var(--accent-strong)" : "var(--text-faint)" }}
        >
          <span aria-hidden>▶</span>
          Next Action
          {missingNextAction && (
            <span className="ml-auto normal-case text-[0.75rem] font-normal" style={{ color: "var(--accent-strong)" }}>
              — No next action defined · this project may stall
            </span>
          )}
        </p>
        <InlineEdit
          value={plan.nextAction}
          placeholder="What's the very next step?"
          onSave={(val) => setNextActionAction({ projectId, nextAction: val }).then(() => {})}
        />
      </div>

      {/* Goal + Why */}
      <div className="grid gap-3 sm:grid-cols-2">
        <PlanRow label="Goal">
          <InlineEdit
            value={plan.goal}
            placeholder="What does success look like?"
            multiline
            onSave={(val) => updateProjectPlanAction({ projectId, goal: val ?? undefined }).then(() => {})}
          />
        </PlanRow>
        <PlanRow label="Why it matters">
          <InlineEdit
            value={plan.whyItMatters}
            placeholder="Why does this project matter?"
            multiline
            onSave={(val) => updateProjectPlanAction({ projectId, whyItMatters: val ?? undefined }).then(() => {})}
          />
        </PlanRow>
      </div>

      {/* Next Milestone */}
      <PlanRow label="Next milestone">
        <InlineEdit
          value={plan.nextMilestone}
          placeholder="What's the next meaningful checkpoint?"
          onSave={(val) => updateProjectPlanAction({ projectId, nextMilestone: val ?? undefined }).then(() => {})}
        />
      </PlanRow>

      {/* Blockers + Open questions */}
      <div className="grid gap-3 sm:grid-cols-2">
        <PlanRow label="Blockers">
          <ArrayField
            label="Blockers"
            items={plan.blockers}
            placeholder="What's in the way?"
            onAdd={(b) => addProjectBlockerAction({ projectId, blocker: b }).then(() => {})}
            onRemove={(b) => removeProjectBlockerAction({ projectId, blocker: b }).then(() => {})}
          />
        </PlanRow>
        <PlanRow label="Open questions">
          <ArrayField
            label="Open questions"
            items={plan.openQuestions}
            placeholder="What's unresolved?"
            onAdd={(q) => addProjectQuestionAction({ projectId, question: q }).then(() => {})}
            onRemove={(q) => removeProjectQuestionAction({ projectId, question: q }).then(() => {})}
          />
        </PlanRow>
      </div>

      {/* Plan notes */}
      <PlanRow label="Plan notes">
        <InlineEdit
          value={plan.planNotes}
          placeholder="Scratch pad — context, links, constraints…"
          multiline
          onSave={(val) => updateProjectPlanAction({ projectId, planNotes: val ?? undefined }).then(() => {})}
        />
      </PlanRow>
    </section>
  );
}
