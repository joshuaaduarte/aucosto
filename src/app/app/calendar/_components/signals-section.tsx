import type { CalendarSignal } from "../_lib/derive";

export function SignalsSection({ signals }: { signals: CalendarSignal[] }) {
  if (signals.length === 0) return null;

  return (
    <section className="fade-in-delay-1 rounded-md border p-4 sm:p-5" style={{ borderColor: "var(--border-soft)", background: "var(--bg-page)" }}>
      <div className="flex items-center justify-between gap-3">
        <p
          className="text-[0.6875rem] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-faint)" }}
        >
          Today&apos;s signals
        </p>
        <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
          {signals.length} {signals.length === 1 ? "note" : "notes"}
        </p>
      </div>
      <ul className="mt-3 space-y-1.5">
        {signals.slice(0, 2).map((signal, i) => (
          <li
            key={`${signal.title}-${i}`}
            className="grid grid-cols-[16px_1fr] items-start gap-3 rounded-md px-2 py-2"
          >
            <span
              className="mt-1.25 inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: "var(--text)" }}
            />
            <div>
              <p
                className="text-[0.875rem] font-medium"
                style={{ color: "var(--text)" }}
              >
                {signal.title}
              </p>
              <p
                className="mt-0.5 text-[0.8125rem]"
                style={{ color: "var(--text-muted)" }}
              >
                {signal.detail}
              </p>
            </div>
          </li>
        ))}
      </ul>
      {signals.length > 2 ? (
        <p className="mt-2 px-2 text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
          +{signals.length - 2} more inferences. Keep this section short and useful.
        </p>
      ) : null}
    </section>
  );
}
