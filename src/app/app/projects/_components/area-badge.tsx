export type AreaView = { id: string; name: string; color: string };

export function AreaBadge({
  area,
  className,
}: {
  area: { name: string; color: string } | null;
  className?: string;
}) {
  if (!area) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${className ?? ""}`}
      style={{ color: "var(--text-muted)" }}
    >
      <span
        className="inline-block h-2 w-2 shrink-0 rounded-full"
        style={{ background: area.color }}
        aria-hidden
      />
      <span className="text-[0.75rem] font-medium">{area.name}</span>
    </span>
  );
}
