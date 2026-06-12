import Link from "next/link";
import { RHYTHM_DEFINITIONS, type RhythmType } from "@/lib/rhythms";
import { categoryColor } from "@/lib/time-categories";

// Contextual hub nudge: surfaces the rhythm that fits the current part of the
// day (or confirms one is already running). Presentational — the hub page
// resolves `suggestedType` from the hour and `activeType` from the service.
export function RhythmNudge({
  suggestedType,
  activeType,
}: {
  suggestedType: RhythmType;
  activeType: RhythmType | null;
}) {
  // If something is already running, celebrate that over the time-of-day hint.
  const focusType = activeType ?? suggestedType;
  const def = RHYTHM_DEFINITIONS[focusType];
  const accent = categoryColor(def.colorKey);
  const isActive = activeType !== null;

  return (
    <Link
      href="/app/rhythms"
      className="group flex items-center gap-3 rounded-md border px-4 py-3 transition-colors hover:bg-bg-hover"
      style={{
        borderColor: "var(--border-faint)",
        borderLeft: `3px solid ${accent}`,
        background: "var(--bg-page)",
      }}
    >
      <span aria-hidden className="text-[1.375rem] leading-none">
        {def.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.875rem] font-semibold" style={{ color: "var(--text)" }}>
          {isActive ? `${def.name} in progress` : `Time for ${def.name}?`}
        </p>
        <p className="mt-0.5 text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
          {isActive ? "Tap to end it when you're done." : def.description}
        </p>
      </div>
      {isActive ? (
        <span
          className="ink-pulse inline-block h-2 w-2 shrink-0 rounded-full"
          style={{ background: "var(--accent)" }}
          aria-hidden
        />
      ) : (
        <span
          className="shrink-0 text-[0.75rem] font-medium opacity-0 transition-opacity group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100"
          style={{ color: "var(--text-faint)" }}
        >
          Start →
        </span>
      )}
    </Link>
  );
}
