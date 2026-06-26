"use client";

import { useTransition, useState } from "react";
import type { CapturedInsight } from "@/lib/services/captured-insights";
import { unlinkInsightFromPersonAction } from "../actions";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

export function InsightsSection({
  personId,
  insights,
}: {
  personId: string;
  insights: CapturedInsight[];
}) {
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  function handleUnlink(insightId: string) {
    setRemoved((prev) => new Set(prev).add(insightId));
    startTransition(async () => {
      await unlinkInsightFromPersonAction(insightId, personId);
    });
  }

  const visible = insights.filter((i) => !removed.has(i.id));
  if (visible.length === 0) return null;

  return (
    <section className="fade-in-delay-1 space-y-2">
      <h2
        className="text-[0.6875rem] font-semibold uppercase tracking-wider"
        style={{ color: "var(--text-faint)" }}
      >
        Insights
      </h2>
      <div
        className="rounded-lg"
        style={{
          background: "var(--bg-tint)",
          border: "1px solid var(--border-faint)",
        }}
      >
        {visible.map((insight) => (
          <div key={insight.id} className="flex items-start gap-3 px-4 py-3">
            <span
              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: "#f59e0b" }}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p
                className="text-[0.8125rem] leading-snug"
                style={{ color: "var(--text)" }}
              >
                {insight.text}
              </p>
              <p
                className="mt-0.5 text-[0.6875rem]"
                style={{ color: "var(--text-ghost)" }}
              >
                {insight.sourceTool}
                {insight.occurredAt ? ` · ${formatDate(insight.occurredAt)}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleUnlink(insight.id)}
              className="shrink-0 text-[0.6875rem] font-medium opacity-0 transition-opacity group-hover:opacity-100 hover:opacity-100 focus:opacity-100 [@media(pointer:coarse)]:opacity-100"
              style={{ color: "var(--text-ghost)" }}
              title="Unlink this insight from this person"
            >
              Unlink
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
