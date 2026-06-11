"use client";

// "What specifically?" — optional, non-blocking detail for a running session
// started from a one-tap chip. Free text plus one-tap chips of labels you've
// recently used in the same category. Renaming never touches the clock.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { describeEntryAction } from "./actions";

export function DescribeRow({
  entryId,
  currentLabel,
  recentLabels,
}: {
  entryId: string;
  currentLabel: string;
  recentLabels: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [activeChip, setActiveChip] = useState<string | null>(null);

  const rename = (label: string, chip?: string) => {
    const trimmed = label.trim();
    if (!trimmed || trimmed === currentLabel || pending) return;
    setActiveChip(chip ?? null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", entryId);
      formData.set("label", trimmed);
      await describeEntryAction(formData);
      setText("");
      setActiveChip(null);
      router.refresh();
    });
  };

  return (
    <div className="mt-3 space-y-2">
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          rename(text);
        }}
      >
        <input
          type="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="What specifically? (optional)"
          enterKeyHint="done"
          className="field"
          style={{ maxWidth: "20rem" }}
          aria-label="Describe this session"
        />
        {text.trim() ? (
          <button type="submit" disabled={pending} className="btn-ghost shrink-0">
            {pending && !activeChip ? "Saving..." : "Save"}
          </button>
        ) : null}
      </form>

      {recentLabels.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className="text-[0.625rem] font-medium uppercase tracking-wider"
            style={{ color: "var(--text-faint)" }}
          >
            Recent
          </span>
          {recentLabels.map((label) => (
            <button
              key={label}
              type="button"
              disabled={pending}
              onClick={() => rename(label, label)}
              className="inline-flex items-center rounded px-2 py-1 text-[0.75rem] font-medium transition-colors"
              style={{
                background: "var(--bg-tint)",
                color: "var(--text-muted)",
                opacity: pending && activeChip !== label ? 0.55 : 1,
              }}
            >
              {activeChip === label && pending ? "Saving..." : label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
