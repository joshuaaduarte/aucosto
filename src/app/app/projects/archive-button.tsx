"use client";

import { useFormStatus } from "react-dom";
import { archiveProjectAction } from "./actions";

function Submit({ archived }: { archived: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-ghost text-[0.75rem]"
      style={{ color: "var(--text-faint)" }}
    >
      {pending
        ? archived
          ? "Archiving…"
          : "Restoring…"
        : archived
          ? "Archive"
          : "Restore"}
    </button>
  );
}

/** Archive a live project, or restore an archived one. */
export function ArchiveProjectButton({
  projectId,
  archived,
}: {
  /** Whether the action archives (true) or restores (false). */
  projectId: string;
  archived: boolean;
}) {
  return (
    <form action={archiveProjectAction}>
      <input type="hidden" name="id" value={projectId} />
      <input type="hidden" name="archived" value={archived ? "1" : "0"} />
      <Submit archived={archived} />
    </form>
  );
}
