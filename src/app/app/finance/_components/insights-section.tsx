import { formatTransactionType } from "@/lib/finance-types";
import { formatUSDFromCents } from "@/lib/money";
import type { FinanceDashboard } from "../_lib/derive";
import { SectionCard, typeTone } from "./ui";

export function InsightsSection({ data }: { data: FinanceDashboard }) {
  const {
    typeSummary,
    snapshot,
    topCategories,
    topMerchants,
    recurringCandidates,
    count,
  } = data;

  return (
    <section id="insights" className="space-y-12">
      <header>
        <p
          className="text-[0.6875rem] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-faint)" }}
        >
          Patterns
        </p>
        <h2
          className="mt-1 text-[1.25rem] font-semibold tracking-tight"
          style={{ color: "var(--text)" }}
        >
          What the entries, taken together, suggest.
        </h2>
      </header>

      <div className="grid gap-12 xl:grid-cols-[1.15fr_0.85fr] xl:gap-14">
        {count > 0 && (
          <SectionCard
            title="The Movement Mix"
            subtitle="True spend, separated from transfers, payoffs, and inflows."
          >
            {typeSummary.length > 0 ? (
              <ul>
                {typeSummary.map((item) => (
                  <li
                    key={item.type}
                    className="grid grid-cols-[1fr_auto] items-baseline gap-4 py-3"
                    style={{ borderTop: "1px solid var(--border-faint)" }}
                  >
                    <div className="min-w-0">
                      <span
                        className={`inline-flex items-center rounded px-1.5 py-0.5 text-[0.6875rem] font-medium ${typeTone(item.type)}`}
                      >
                        {formatTransactionType(item.type)}
                      </span>
                      <p
                        className="mt-1 text-[0.75rem]"
                        style={{ color: "var(--text-faint)" }}
                      >
                        {item.count} entr{item.count === 1 ? "y" : "ies"}
                      </p>
                    </div>
                    <p
                      className="text-[0.875rem] tabular font-medium"
                      style={{ color: "var(--text)" }}
                    >
                      {formatUSDFromCents(item.amountCents)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p
                className="text-[0.875rem]"
                style={{ color: "var(--text-muted)" }}
              >
                Import entries to read the movement split.
              </p>
            )}
          </SectionCard>
        )}

        <SectionCard
          title="Cash Position"
          subtitle="What is at hand against what is owed."
        >
          <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-3">
            <CashTile label="Available" value={formatUSDFromCents(snapshot.cashCents)} />
            <CashTile label="Cards owed" value={formatUSDFromCents(snapshot.cardsOwedCents)} owed />
            <CashTile label="Loans owed" value={formatUSDFromCents(snapshot.loansOwedCents)} owed />
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-10 xl:grid-cols-3 xl:gap-12">
        <SectionCard
          title="Top categories"
          subtitle="Where true spend is concentrating this month."
        >
          {topCategories.length === 0 ? (
            <p className="text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
              No spending recorded this month.
            </p>
          ) : (
            <ul>
              {topCategories.map((category, i) => (
                <Row
                  key={category.category}
                  index={i + 1}
                  title={category.category}
                  hint={`${category.count} entr${category.count === 1 ? "y" : "ies"}`}
                  value={formatUSDFromCents(category.spendCents)}
                />
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Top merchants"
          subtitle="The biggest names in this month's accounts."
        >
          {topMerchants.length === 0 ? (
            <p className="text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
              No spending recorded this month.
            </p>
          ) : (
            <ul>
              {topMerchants.map((merchant, i) => (
                <Row
                  key={merchant.merchant}
                  index={i + 1}
                  title={merchant.merchant}
                  hint={`${merchant.count} entr${merchant.count === 1 ? "y" : "ies"}`}
                  value={formatUSDFromCents(merchant.spendCents)}
                />
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Recurring"
          subtitle="Charges that appear, again, on the regular."
        >
          {recurringCandidates.length === 0 ? (
            <p className="text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
              No strong patterns yet.
            </p>
          ) : (
            <ul>
              {recurringCandidates.map((item) => (
                <Row
                  key={`${item.merchant}-${item.amountCents}-${item.account ?? ""}`}
                  title={item.merchant}
                  hint={`${item.count} charges${item.account ? ` · ${item.account}` : ""} · last ${item.lastDate.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`}
                  value={formatUSDFromCents(item.amountCents)}
                />
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </section>
  );
}

function CashTile({
  label,
  value,
  owed = false,
}: {
  label: string;
  value: string;
  owed?: boolean;
}) {
  return (
    <div
      className="py-2"
      style={{ borderLeft: "1px solid var(--border)", paddingLeft: "1rem" }}
    >
      <p
        className="text-[0.6875rem] font-semibold uppercase tracking-wider"
        style={{ color: "var(--text-faint)" }}
      >
        {label}
      </p>
      <p
        className="mt-1 text-[1.125rem] font-semibold tracking-tight tabular"
        style={{
          color: owed ? "var(--accent-strong)" : "var(--text)",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </p>
    </div>
  );
}

function Row({
  index,
  title,
  hint,
  value,
}: {
  index?: number;
  title: string;
  hint: string;
  value: string;
}) {
  return (
    <li
      className="grid grid-cols-[auto_1fr_auto] items-baseline gap-3 py-2.5"
      style={{ borderTop: "1px solid var(--border-faint)" }}
    >
      {index !== undefined ? (
        <span
          className="text-[0.6875rem] tabular font-medium"
          style={{ color: "var(--text-faint)" }}
        >
          {String(index).padStart(2, "0")}
        </span>
      ) : (
        <span />
      )}
      <div className="min-w-0">
        <p
          className="truncate text-[0.875rem] font-medium"
          style={{ color: "var(--text)" }}
        >
          {title}
        </p>
        <p
          className="mt-0.5 text-[0.75rem]"
          style={{ color: "var(--text-faint)" }}
        >
          {hint}
        </p>
      </div>
      <span
        className="text-[0.8125rem] tabular font-medium"
        style={{ color: "var(--text)" }}
      >
        {value}
      </span>
    </li>
  );
}
