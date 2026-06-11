import type { CalendarTodayBuckets } from "../_lib/derive";
import { CalendarItemCard } from "./calendar-item-card";
import { SectionCard } from "./section-card";

export function TodayBucketSections({
  buckets,
}: {
  buckets: CalendarTodayBuckets;
}) {
  const showNowSection = buckets.now.length > 0;
  const showNextSection = buckets.next.length > 0;
  const showAttentionSection = buckets.needsAttention.length > 0;
  const showLaterSection = buckets.later.length > 0;

  return (
    <>
      <section className="grid gap-6">
        {(showNowSection || showNextSection) ? (
          <div className="grid gap-6 xl:grid-cols-2">
            {showNowSection ? (
              <SectionCard eyebrow="Now" title="What matters first.">
                <ol className="space-y-3">
                  {buckets.now.map((item) => (
                    <CalendarItemCard key={item.id} item={item} />
                  ))}
                </ol>
              </SectionCard>
            ) : null}

            {showNextSection ? (
              <SectionCard eyebrow="Next" title="What you should protect next.">
                <ol className="space-y-3">
                  {buckets.next.map((item) => (
                    <CalendarItemCard key={item.id} item={item} />
                  ))}
                </ol>
              </SectionCard>
            ) : null}
          </div>
        ) : (
          <section
            className="rounded-md border px-4 py-4"
            style={{
              borderColor: "var(--border-soft)",
              background: "var(--bg-page)",
            }}
          >
            <p
              className="text-[0.6875rem] font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-faint)" }}
            >
              Open space
            </p>
            <p
              className="mt-1 text-[1rem] font-semibold tracking-tight"
              style={{ color: "var(--text)" }}
            >
              The day is still open.
            </p>
            <p className="mt-2 text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
              Use the add button when you know the next block worth protecting.
            </p>
          </section>
        )}
      </section>

      {(showAttentionSection || showLaterSection) ? (
        <section className="grid gap-6 lg:grid-cols-2">
          {showAttentionSection ? (
            <SectionCard eyebrow="Needs attention" title="Unfinished blocks you may want to move.">
              <ol className="space-y-3">
                {buckets.needsAttention.map((item) => (
                  <CalendarItemCard
                    key={item.id}
                    item={item}
                    showAttentionActions
                  />
                ))}
              </ol>
            </SectionCard>
          ) : null}

          {showLaterSection ? (
            <SectionCard eyebrow="Later today" title="Everything else still on deck.">
              <ol className="space-y-3">
                {buckets.later.map((item) => (
                  <CalendarItemCard key={item.id} item={item} />
                ))}
              </ol>
            </SectionCard>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
