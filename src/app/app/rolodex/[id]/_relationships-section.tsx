"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { RolodexRelation } from "@/lib/services/rolodex";
import type { RolodexPersonSummary } from "@/lib/services/rolodex";
import { RELATION_TYPES } from "@/lib/services/rolodex";
import { createRelationAction, deleteRelationAction } from "../actions";

const TYPE_LABELS: Record<string, string> = {
  spouse: "Spouse",
  partner: "Partner",
  pet_of: "Pet of",
  parent: "Parent",
  child: "Child",
  sibling: "Sibling",
  friend: "Friend",
  coworker: "Coworker",
  manager: "Manager",
  reports_to: "Reports to",
  works_at: "Works at",
  knows: "Knows",
  other: "Other",
};

function relationLabel(rel: RolodexRelation, entityId: string): { label: string; name: string; linkedId: string } {
  const isFrom = rel.fromEntityId === entityId;
  const name = isFrom ? (rel.toEntityName ?? "Unknown") : (rel.fromEntityName ?? "Unknown");
  const linkedId = isFrom ? rel.toEntityId : rel.fromEntityId;
  const typeLabel = rel.label || TYPE_LABELS[rel.type] || rel.type;
  return { label: typeLabel, name, linkedId };
}

export function RelationshipsSection({
  entityId,
  relations,
  allPersons,
}: {
  entityId: string;
  relations: RolodexRelation[];
  allPersons: RolodexPersonSummary[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [relType, setRelType] = useState("knows");
  const [label, setLabel] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const filtered = search.trim()
    ? allPersons
        .filter((p) => p.id !== entityId && p.displayName.toLowerCase().includes(search.toLowerCase()))
        .slice(0, 8)
    : allPersons.filter((p) => p.id !== entityId).slice(0, 5);

  const selectedPerson = allPersons.find((p) => p.id === selectedId);

  function handleCreate() {
    if (!selectedId || !relType) return;
    setError("");
    const fd = new FormData();
    fd.set("fromEntityId", entityId);
    fd.set("toEntityId", selectedId);
    fd.set("type", relType);
    if (label.trim()) fd.set("label", label.trim());

    startTransition(async () => {
      const res = await createRelationAction(fd);
      if (res.ok) {
        setShowForm(false);
        setSearch("");
        setSelectedId("");
        setRelType("knows");
        setLabel("");
      } else {
        setError(res.error);
      }
    });
  }

  function handleDelete(relationId: string) {
    startTransition(async () => {
      await deleteRelationAction(relationId);
    });
  }

  return (
    <section className="fade-in-delay-2 space-y-3">
      <div className="flex items-center justify-between">
        <h2
          className="text-[0.6875rem] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-faint)" }}
        >
          Relationships ({relations.length})
        </h2>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="text-[0.8125rem] font-medium"
          style={{ color: "var(--accent)" }}
        >
          {showForm ? "Cancel" : "+ Add"}
        </button>
      </div>

      {showForm && (
        <div
          className="space-y-3 rounded-xl p-4"
          style={{ background: "var(--bg-tint)", border: "1px solid var(--border-faint)" }}
        >
          {error && (
            <p className="text-[0.8125rem]" style={{ color: "var(--accent-strong)" }}>
              {error}
            </p>
          )}
          <div>
            <label className="mb-1 block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
              Relates to
            </label>
            {selectedId && selectedPerson ? (
              <div className="flex items-center gap-2">
                <span className="text-[0.875rem] font-medium" style={{ color: "var(--text)" }}>
                  {selectedPerson.displayName}
                </span>
                <button
                  type="button"
                  onClick={() => { setSelectedId(""); setSearch(""); }}
                  className="text-[0.75rem]"
                  style={{ color: "var(--text-faint)" }}
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search contacts…"
                  className="field w-full text-[0.8125rem]"
                />
                {filtered.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {filtered.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedId(p.id)}
                        className="block w-full rounded-md px-2 py-1.5 text-left text-[0.8125rem] transition-colors hover:bg-bg-hover"
                        style={{ color: "var(--text)" }}
                      >
                        {p.displayName}
                        {p.contactKind !== "person" && (
                          <span className="ml-1 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
                            ({p.contactKind})
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                Relationship type
              </label>
              <select
                value={relType}
                onChange={(e) => setRelType(e.target.value)}
                className="field w-full text-[0.8125rem]"
              >
                {RELATION_TYPES.map((t) => (
                  <option key={t} value={t}>{TYPE_LABELS[t] ?? t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                Label override <span style={{ color: "var(--text-faint)" }}>(optional)</span>
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. college roommate"
                className="field w-full text-[0.8125rem]"
                maxLength={200}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!selectedId || isPending}
            className="btn-ghost px-3 py-1.5 text-[0.8125rem] font-medium"
            style={{ color: "var(--accent)" }}
          >
            {isPending ? "Saving…" : "Save"}
          </button>
        </div>
      )}

      {relations.length === 0 && !showForm && (
        <p className="text-[0.8125rem]" style={{ color: "var(--text-ghost)" }}>
          No relationships yet.
        </p>
      )}

      {relations.length > 0 && (
        <div
          className="rounded-lg divide-y"
          style={{ background: "var(--bg-tint)", border: "1px solid var(--border-faint)" }}
        >
          {relations.map((rel) => {
            const { label: typeLabel, name, linkedId } = relationLabel(rel, entityId);
            return (
              <div key={rel.id} className="flex items-center gap-2 px-4 py-2.5">
                <span className="shrink-0 text-[0.75rem] font-medium" style={{ color: "var(--text-muted)" }}>
                  {typeLabel}:
                </span>
                <Link
                  href={`/app/rolodex/${linkedId}`}
                  className="flex-1 truncate text-[0.875rem] font-medium hover:underline"
                  style={{ color: "var(--text)" }}
                >
                  {name}
                </Link>
                {rel.notes && (
                  <span className="hidden sm:inline truncate text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
                    {rel.notes}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(rel.id)}
                  disabled={isPending}
                  className="shrink-0 text-[0.75rem]"
                  style={{ color: "var(--text-ghost)" }}
                  title="Remove relationship"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
