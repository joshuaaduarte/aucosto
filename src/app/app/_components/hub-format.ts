// Pure formatting helpers shared by the hub page and its sections.

export function humanizeDoStatus(status: string) {
  switch (status) {
    case "in_progress":
      return "in progress";
    case "ready":
      return "ready";
    case "scheduled":
      return "scheduled";
    case "waiting":
      return "waiting";
    case "done":
      return "done";
    default:
      return status;
  }
}

export function formatMinutesLabel(minutes: number | null | undefined) {
  if (!minutes || minutes <= 0) return "no estimate yet";
  if (minutes < 60) return `${minutes}m estimate`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0
    ? `${hours}h estimate`
    : `${hours}h ${remainder}m estimate`;
}

export function formatShortWhen(date: Date) {
  return date.toLocaleString([], {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatHoursMs(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
