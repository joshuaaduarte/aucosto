"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { RolodexInteraction } from "@/lib/services/rolodex";
import { addInteractionAction, updateFollowUpAction } from "../actions";

const SOURCE_META: Record<string, { label: string; color: string; getHref: (id: string) => string | null }> = {
  time:       { label: "Time entry",  color: "#10b981", getHref: () => "/app/time" },
  reflection: { label: "Reflection",  color: "#8b5cf6", getHref: () => "/app/reflect" },
  calendar:   { label: "Calendar",    color: "#3b82f6", getHref: () => "/app/calendar" },
  project:    { label: "Project",     color: "#f97316", getHref: (id) => `/app/projects/${id}` },
  do:         { label: "Task",        color: "#14b8a6", getHref: () => "/app/do" },
  manual:     { label: "Manual",      color: "#9ca3af", getHref: () => null },
  assistant:  { label: "Assistant",   color: "#6366f1", getHref: () => null },
};

const BODY_PREVIEW_CHARS = 220;

function getSourceMeta(tool: string | null) {
  const key = tool ?? "manual";
  return SOURCE_META[key] ?? SOURCE_META["manual"]!;
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

function getFollowUpLabel(date: string | null): string {
  if (!date) return "Follow-up needed";
  const now = new Date();
  const d = new Date(date);
  if (d < now) return `Overdue: ${formatDate(date)}`;
  return `Follow-up: ${formatDate(date)}`;
}

function nowLocalDatetimeString(): string {
  const now = new Date();
  now.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `T${pad(now.getHours())}:${pad(now.getMinutes())}`
  );
}

function groupByMonth(items: RolodexInteraction[]): Array<{ label: string; items: RolodexInteraction[] }> {
  const groups: Array<{ key: string; label: string; items: RolodexInteraction[] }> = [];
  for (const item of items) {
    const d = new Date(item.occurredAt);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const existing = groups.find((g) => g.key === key);
    if (existing) {
      existing.items.push(item);
    } else {
      groups.push({
        key,
        label: d.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
        items: [item],
      });
    }
  }
  return groups;
}

export function InteractionTimeline({
  personId,
  personName,
  interactions,
}: {
  personId: string;
  personName: string;
  interactions: RolodexInteraction[];
}) {
  const [expandedBodies, setExpandedBodies] = useState<Set<string>>(new Set());
  const [showAddForm, setShowAddForm] = useState(false);
  const [doneOptimistic, setDoneOptimistic] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [occurredAt, setOccurredAt] = useState(nowLocalDatetimeString);
  const [followUpNeeded, setFollowUpNeeded] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");
  const [addError, setAddError] = useState("");
  const [addPending, setAddPending] = useState(false);

  function toggleBody(id: string) {
    setExpandedBodies((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleMarkDone(interactionId: string) {
    setDoneOptimistic((prev) => new Set(prev).add(interactionId));
    startTransition(async () => {
      await updateFollowUpAction(interactionId, false, personId);
    });
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setAddError("");
    setAddPending(true);
    try {
      const result = await addInteractionAction(
        personId,
        title,
        body || undefined,
        followUpNeeded,
        followUpNeeded && followUpDate ? followUpDate : undefined,
        occurredAt || undefined,
      );
      if (result.ok) {
        setTitle("");
        setBody("");
        setFollowUpNeeded(false);
        setFollowUpDate("");
        setOccurredAt(nowLocalDatetimeString());
        setShowAddForm(false);
      } else {
        setAddError(result.error);
      }
    } finally {
      setAddPending(false);
    }
  }

  const grouped = groupByMonth(interactions);

  return (
    <section className="fade-in-delay-2 space-y-4">
      <div className="flex items-center justify-between">
        <h2
          className="text-[0.6875rem] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-faint)" }}
        >
          Interactions ({interactions.length})
        </h2>
        <button
          type="button"
          onClick={() => setShowAddForm((v) => !v)}
          className="text-[0.8125rem] font-medium"
          style={{ color: "var(--accent)" }}
        >
          {showAddForm ? "Cancel" : "+ Add"}
        </button>
      </div>

      {showAddForm && (
        <form
          onSubmit={handleAdd}
          className="space-y-3 rounded-xl p-4"
          style={{ background: "var(--bg-tint)", border: "1px solid var(--border-faint)" }}
        >
          {addError && (
            <p className="text-[0.8125rem]" style={{ color: "var(--accent-strong)" }}>
              {addError}
            </p>
          )}
          <div>
            <label
              className="mb-1 block text-[0.8125rem] font-medium"
              style={{ color: "var(--text-muted)" }}
            >
              What happened *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={300}
              placeholder="e.g. Coffee catch-up, Quick call, Sent intro email…"
              className="field w-full"
            />
          </div>
          <div>
            <label
              className="mb-1 block text-[0.8125rem] font-medium"
              style={{ color: "var(--text-muted)" }}
            >
              Notes
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              maxLength={5000}
              placeholder="What did you discuss? What context should you remember?"
              className="field w-full resize-none text-[0.875rem]"
            />
          </div>
          <div>
            <label
              className="mb-1 block text-[0.8125rem] font-medium"
              style={{ color: "var(--text-muted)" }}
            >
              When
            </label>
            <input
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              className="field"
            />
          </div>
          <label
            className="flex items-center gap-2 text-[0.875rem]"
            style={{ color: "var(--text-muted)" }}
          >
            <input
              type="checkbox"
              checked={followUpNeeded}
              onChange={(e) => setFollowUpNeeded(e.target.checked)}
            />
            Follow-up needed
          </label>
          {followUpNeeded && (
            <div>
              <label
                className="mb-1 block text-[0.8125rem]"
                style={{ color: "var(--text-muted)" }}
              >
                Follow-up by
              </label>
              <input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className="field"
              />
            </div>
          )}
          <button
            type="submit"
            disabled={!title.trim() || addPending}
            className="btn-ghost px-3 py-1.5 text-[0.875rem] font-medium"
            style={{ color: "var(--accent)" }}
          >
            {addPending ? "Saving…" : "Log interaction"}
          </button>
        </form>
      )}

      {interactions.length === 0 && !showAddForm && (
        <div
          className="rounded-xl p-6 text-center"
          style={{ background: "var(--bg-tint)", border: "1px solid var(--border-faint)" }}
        >
          <p className="text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
            No interactions yet. Add a note above, or{" "}
            <span className="font-medium" style={{ color: "var(--text)" }}>
              @{personName}
            </span>{" "}
            in a time entry, reflection, or calendar event to log one automatically.
          </p>
        </div>
      )}

      {grouped.map((group) => (
        <div key={group.label} className="space-y-2">
          {(interactions.length > 1 || grouped.length > 1) && (
            <p
              className="text-[0.6875rem] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-ghost)" }}
            >
              {group.label}
            </p>
          )}
          <div className="space-y-2">
            {group.items.map((interaction) => {
              const meta = getSourceMeta(interaction.sourceTool);
              const href = interaction.sourceRecordId
                ? meta.getHref(interaction.sourceRecordId)
                : null;
              const isExpanded = expandedBodies.has(interaction.id);
              const bodyIsTruncated =
                !!interaction.body && interaction.body.length > BODY_PREVIEW_CHARS;
              const displayBody = interaction.body
                ? bodyIsTruncated && !isExpanded
                  ? interaction.body.slice(0, BODY_PREVIEW_CHARS) + "…"
                  : interaction.body
                : null;
              const isFollowUpDone = doneOptimistic.has(interaction.id);
              const showFollowUp = interaction.followUpNeeded && !isFollowUpDone;

              return (
                <div
                  key={interaction.id}
                  className="rounded-lg p-3"
                  style={{ background: "var(--bg-tint)", border: "1px solid var(--border-faint)" }}
                >
                  {/* Header */}
                  <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
                    <span
                      className="mt-0.5 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-medium"
                      style={{
                        background: `${meta.color}1a`,
                        color: meta.color,
                      }}
                    >
                      {meta.label}
                    </span>
                    <span
                      className="flex-1 text-[0.875rem] font-medium leading-snug"
                      style={{ color: "var(--text)", minWidth: "8rem" }}
                    >
                      {interaction.title}
                    </span>
                    <time
                      dateTime={interaction.occurredAt}
                      className="shrink-0 text-[0.75rem]"
                      style={{ color: "var(--text-ghost)" }}
                    >
                      {formatDateTime(interaction.occurredAt)}
                    </time>
                  </div>

                  {/* Body */}
                  {displayBody && (
                    <div className="mt-2">
                      <div
                        className="rounded-md px-3 py-2 text-[0.8125rem] leading-relaxed"
                        style={{
                          background: "var(--bg-tint-strong)",
                          borderLeft: `2px solid ${meta.color}60`,
                          color: "var(--text-muted)",
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {displayBody}
                      </div>
                      {bodyIsTruncated && (
                        <button
                          type="button"
                          onClick={() => toggleBody(interaction.id)}
                          className="mt-1 text-[0.75rem] font-medium"
                          style={{ color: "var(--accent)" }}
                        >
                          {isExpanded ? "Show less" : "Show more"}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Footer */}
                  {(showFollowUp || href) && (
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      {showFollowUp && (
                        <div className="flex items-center gap-1.5">
                          <span
                            className="rounded-full px-2 py-0.5 text-[0.6875rem] font-medium"
                            style={{
                              background: "rgba(245, 158, 11, 0.15)",
                              color: "#d97706",
                            }}
                          >
                            {getFollowUpLabel(interaction.followUpDate)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleMarkDone(interaction.id)}
                            className="text-[0.75rem]"
                            style={{ color: "var(--text-ghost)" }}
                          >
                            ✓ done
                          </button>
                        </div>
                      )}
                      {href && (
                        <Link
                          href={href}
                          className="text-[0.75rem] font-medium"
                          style={{ color: "var(--text-ghost)" }}
                        >
                          View source →
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
