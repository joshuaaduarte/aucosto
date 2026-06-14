import type { Momentum, MomentumLevel } from "@/lib/projects";

const MOMENTUM_COLORS: Record<MomentumLevel, string> = {
  alive: "#10b981",
  slowing: "#f59e0b",
  stalled: "#ef4444",
};

export function momentumColor(level: MomentumLevel): string {
  return MOMENTUM_COLORS[level];
}

/**
 * 🟢 Alive / 🟡 Slowing / 🔴 Stalled — the single most important signal on a
 * project card. Renders nothing for done/paused projects (momentum === null).
 */
export function MomentumBadge({
  momentum,
  withLabel = true,
}: {
  momentum: Momentum;
  withLabel?: boolean;
}) {
  if (!momentum) return null;
  const color = MOMENTUM_COLORS[momentum.level];
  return (
    <span
      title={momentum.hint}
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold"
      style={{ background: `${color}1f`, color }}
    >
      <span aria-hidden>{momentum.emoji}</span>
      {withLabel ? momentum.label : null}
    </span>
  );
}
