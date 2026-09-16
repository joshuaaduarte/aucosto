// Collapsible tail of the hub.
//
// The hub had grown to roughly a dozen stacked sections, which on a phone
// means the useful part — what's running, what's planned, what to do next —
// sits above a long scroll of reference material. These sections are still
// worth having; they just aren't worth reading every morning.
//
// Plain <details>, so it needs no client JS and the browser remembers nothing
// the user didn't ask for. Everything inside stays server-rendered.

export function HubMore({ children }: { children: React.ReactNode }) {
  return (
    <details className="hub-more group">
      <summary
        className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-4 py-2.5 text-[0.8125rem] font-medium transition-colors hover:bg-bg-hover"
        style={{ color: "var(--text-faint)" }}
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 11 11"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className="transition-transform group-open:rotate-90"
        >
          <path d="m4 3 2.5 2.5L4 8" />
        </svg>
        <span className="group-open:hidden">More — actions, decisions, tools</span>
        <span className="hidden group-open:inline">Less</span>
      </summary>
      <div className="mt-3 space-y-7 sm:space-y-8">{children}</div>
    </details>
  );
}
