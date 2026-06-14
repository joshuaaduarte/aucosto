"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { tagTimeEntryAction } from "../projects/actions";

export type ProjectOption = { id: string; name: string; color: string };

/**
 * Subtle "tag a project" affordance on time entries that aren't linked to a
 * project yet. Opens a small menu of the user's active projects; picking one
 * retroactively links the entry (and shows up as a chip after revalidation).
 */
export function TagProjectButton({
  entryId,
  options,
}: {
  entryId: string;
  options: ProjectOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (options.length === 0) return null;

  function tag(projectId: string) {
    setOpen(false);
    startTransition(async () => {
      await tagTimeEntryAction(entryId, projectId);
      router.refresh();
    });
  }

  return (
    <span ref={containerRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.625rem] font-medium opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 [@media(pointer:coarse)]:opacity-100"
        style={{ background: "var(--bg-tint)", color: "var(--text-faint)" }}
        title="Tag a project"
      >
        {pending ? "…" : "＋ project"}
      </button>

      {open ? (
        <span
          className="absolute left-0 top-full z-10 mt-1 flex max-h-56 w-48 flex-col overflow-y-auto rounded-md border py-1 shadow-md"
          style={{ background: "var(--bg-page)", borderColor: "var(--border)" }}
        >
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => tag(option.id)}
              className="flex items-center gap-2 px-2.5 py-1.5 text-left text-[0.8125rem] hover:bg-bg-hover"
              style={{ color: "var(--text)" }}
            >
              <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: option.color }} aria-hidden />
              <span className="truncate">{option.name}</span>
            </button>
          ))}
        </span>
      ) : null}
    </span>
  );
}
