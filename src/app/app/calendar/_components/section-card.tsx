import type { ReactNode } from "react";

export function SectionCard({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <section
      className="rounded-md p-5"
      style={{
        background: "var(--bg-page)",
        border: "1px solid var(--border-soft)",
      }}
    >
      <p
        className="text-[0.6875rem] font-semibold uppercase tracking-wider"
        style={{ color: "var(--text-faint)" }}
      >
        {eyebrow}
      </p>
      {title ? (
        <h2
          className="mt-1 text-[1rem] font-semibold tracking-tight"
          style={{ color: "var(--text)" }}
        >
          {title}
        </h2>
      ) : null}
      <div className={title ? "mt-4" : "mt-3"}>{children}</div>
    </section>
  );
}
