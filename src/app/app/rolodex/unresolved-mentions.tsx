"use client";

import { useState, useTransition } from "react";
import type { RolodexPersonSummary, RolodexMention } from "@/lib/services/rolodex";
import {
  createPersonFromMentionAction,
  linkMentionToPersonAction,
} from "@/app/app/rolodex/actions";

const SOURCE_LABELS: Record<string, string> = {
  reflection: "daily reflection",
  time: "time entry",
  calendar: "calendar event",
  project: "project notes",
  do: "task",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

function MentionRow({
  mention,
  persons,
  onResolved,
}: {
  mention: RolodexMention;
  persons: RolodexPersonSummary[];
  onResolved: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const filtered = search
    ? persons.filter((p) => p.displayName.toLowerCase().includes(search.toLowerCase()))
    : persons.slice(0, 5);

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const res = await createPersonFromMentionAction(mention.id, mention.mentionedName);
      if (res.ok) {
        onResolved(mention.id);
      } else {
        setError(res.error ?? "Failed");
      }
    });
  }

  function handleLink(personId: string) {
    setError(null);
    startTransition(async () => {
      const res = await linkMentionToPersonAction(mention.id, personId);
      if (res.ok) {
        onResolved(mention.id);
      } else {
        setError(res.error ?? "Failed");
      }
    });
  }

  return (
    <div
      className="rounded-lg px-3 py-2.5 space-y-2"
      style={{ background: "var(--bg-tint)", border: "1px solid var(--border-faint)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="font-medium text-[0.875rem]" style={{ color: "var(--text)" }}>
            @{mention.mentionedName}
          </span>
          <span className="ml-2 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
            from {SOURCE_LABELS[mention.sourceTool] ?? mention.sourceTool} · {formatDate(mention.createdAt)}
          </span>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={handleCreate}
            disabled={isPending}
            className="btn-ghost px-2.5 py-1 text-[0.8125rem] font-medium"
            style={{ color: "var(--accent)" }}
          >
            + New person
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="btn-ghost px-2.5 py-1 text-[0.8125rem] font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            {expanded ? "Cancel" : "Link existing"}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-[0.8125rem]" style={{ color: "var(--destructive)" }}>{error}</p>
      )}

      {expanded && (
        <div className="space-y-2 pt-1">
          <input
            type="search"
            placeholder="Search contacts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="field w-full text-[0.8125rem]"
          />
          <div className="space-y-1">
            {filtered.length === 0 ? (
              <p className="text-[0.8125rem]" style={{ color: "var(--text-ghost)" }}>No contacts found.</p>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleLink(p.id)}
                  disabled={isPending}
                  className="block w-full rounded-md px-3 py-1.5 text-left text-[0.875rem] transition-colors hover:bg-bg-hover"
                  style={{ color: "var(--text)" }}
                >
                  {p.displayName}
                  {p.organization && (
                    <span className="ml-1 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
                      · {p.organization}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function UnresolvedMentionsBanner({
  mentions,
  persons,
}: {
  mentions: RolodexMention[];
  persons: RolodexPersonSummary[];
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);

  const visible = mentions.filter((m) => !dismissed.has(m.id));
  if (visible.length === 0) return null;

  function handleResolved(id: string) {
    setDismissed((prev) => new Set(prev).add(id));
  }

  return (
    <div className="fade-in space-y-2">
      <div
        className="flex items-center justify-between rounded-lg px-3 py-2.5"
        style={{ background: "var(--accent-tint)", border: "1px solid var(--accent-soft)" }}
      >
        <p className="text-[0.875rem] font-medium" style={{ color: "var(--accent-strong)" }}>
          {visible.length} unresolved @{visible.length === 1 ? "mention" : "mentions"}
        </p>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="btn-ghost px-2.5 py-1 text-[0.8125rem] font-medium"
          style={{ color: "var(--accent)" }}
        >
          {expanded ? "Hide" : "Review"}
        </button>
      </div>

      {expanded && (
        <div className="space-y-2">
          {visible.map((mention) => (
            <MentionRow
              key={mention.id}
              mention={mention}
              persons={persons}
              onResolved={handleResolved}
            />
          ))}
        </div>
      )}
    </div>
  );
}
