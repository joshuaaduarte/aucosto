// Route-transition skeleton for every tool page. Server-fetching pages give
// no feedback between tap and render — on a phone that reads as a dead tap.
// Shapes loosely echo the shared page anatomy (eyebrow, title, cards).
export default function AppLoading() {
  return (
    <div className="animate-pulse space-y-8" aria-hidden>
      <div className="space-y-3">
        <div
          className="h-3 w-20 rounded"
          style={{ background: "var(--bg-tint-strong)" }}
        />
        <div
          className="h-8 w-48 rounded"
          style={{ background: "var(--bg-tint-strong)" }}
        />
        <div
          className="h-4 w-64 max-w-full rounded"
          style={{ background: "var(--bg-tint)" }}
        />
      </div>
      <div
        className="h-40 rounded-md"
        style={{ background: "var(--bg-tint)" }}
      />
      <div
        className="h-24 rounded-md"
        style={{ background: "var(--bg-tint)" }}
      />
    </div>
  );
}
