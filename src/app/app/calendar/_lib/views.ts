// Pure calendar-view helpers, importable from both server and client.
//
// These MUST live outside the "use client" view-selector module: the server
// page calls isCalendarView() to validate the ?view param, and Next.js forbids
// invoking a function exported from a client module in server code (it builds
// fine, then throws at request time). Keeping the constant, type, and guard
// here lets page.tsx (server) and view-selector.tsx (client) share one source.

export const CALENDAR_VIEWS = ["1d", "2d", "3d", "w"] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

export function isCalendarView(
  value: string | undefined,
): value is CalendarView {
  return !!value && (CALENDAR_VIEWS as readonly string[]).includes(value);
}
