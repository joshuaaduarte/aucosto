// Wall-clock → absolute-time conversion for forms with date/start/end fields.
//
// Naive "YYYY-MM-DDTHH:mm" strings mean whatever timezone the *parser* is in.
// Forms must convert them to absolute ISO timestamps in the BROWSER (the
// user's timezone) before submitting; server actions should consume the ISO
// fields and never parse wall-clock strings themselves. Pure module — safe
// to import from client components and tests.

export type WallClockWindow = {
  startsAt: Date;
  endsAt: Date;
};

/**
 * Interpret date/start/end in the runtime's local timezone.
 * An end at or before the start is treated as crossing midnight.
 */
export function wallClockWindow(
  date: string,
  start: string,
  end: string,
): WallClockWindow | null {
  if (!date || !start || !end) return null;
  const startsAt = new Date(`${date}T${start}`);
  let endsAt = new Date(`${date}T${end}`);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return null;
  }
  if (endsAt <= startsAt) {
    endsAt = new Date(endsAt.getTime() + 24 * 60 * 60 * 1000);
  }
  return { startsAt, endsAt };
}

/**
 * onSubmit helper: read the form's date/start/end inputs and fill its hidden
 * startsAtIso/endsAtIso inputs with absolute timestamps. Call from a form's
 * onSubmit so the conversion happens client-side, in the user's timezone.
 */
export function fillIsoWindowFields(form: HTMLFormElement): boolean {
  const read = (name: string) =>
    (form.elements.namedItem(name) as HTMLInputElement | null)?.value ?? "";
  const windowValue = wallClockWindow(
    read("date"),
    read("start"),
    read("end"),
  );
  if (!windowValue) return false;
  const startsAtIso = form.elements.namedItem(
    "startsAtIso",
  ) as HTMLInputElement | null;
  const endsAtIso = form.elements.namedItem(
    "endsAtIso",
  ) as HTMLInputElement | null;
  if (!startsAtIso || !endsAtIso) return false;
  startsAtIso.value = windowValue.startsAt.toISOString();
  endsAtIso.value = windowValue.endsAt.toISOString();
  return true;
}

/**
 * Server-action helper: prefer the ISO fields written by fillIsoWindowFields;
 * fall back to parsing the wall-clock fields (correct only when the server
 * shares the user's timezone, e.g. the pinned single-user runtime).
 */
export function windowFromFormData(formData: {
  get(name: string): unknown;
}): WallClockWindow | null {
  const value = (name: string) => String(formData.get(name) ?? "").trim();
  const startsAtIso = value("startsAtIso");
  const endsAtIso = value("endsAtIso");
  if (startsAtIso && endsAtIso) {
    const startsAt = new Date(startsAtIso);
    const endsAt = new Date(endsAtIso);
    if (
      !Number.isNaN(startsAt.getTime()) &&
      !Number.isNaN(endsAt.getTime())
    ) {
      return { startsAt, endsAt };
    }
  }
  return wallClockWindow(value("date"), value("start"), value("end"));
}
