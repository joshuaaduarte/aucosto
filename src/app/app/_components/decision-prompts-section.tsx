import Link from "next/link";
import type { HubPrompt } from "../_lib/hub-prompts";
import { toneAccent } from "./hub-types";
import { ArrowRight } from "./icons";

export function DecisionPromptsSection({ prompts }: { prompts: HubPrompt[] }) {
  if (prompts.length === 0) return null;

  return (
    <section className="fade-in-delay-2">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <p
          className="text-[0.6875rem] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-faint)" }}
        >
          What needs a decision
        </p>
        <p
          className="text-[0.75rem]"
          style={{ color: "var(--text-faint)" }}
        >
          Read these as prompts, not status blurbs.
        </p>
      </div>
      <ul className="space-y-2">
        {prompts.map((prompt, i) => (
          <SignalRow key={`${prompt.text}-${i}`} prompt={prompt} />
        ))}
      </ul>
    </section>
  );
}

function SignalRow({ prompt }: { prompt: HubPrompt }) {
  return (
    <li
      className="grid grid-cols-[1fr] gap-3 rounded-lg border px-3.5 py-3 sm:grid-cols-[1fr_auto] sm:items-start"
      style={{
        borderColor: "var(--border-faint)",
        background: "var(--bg-page)",
        // Tone accent as a scannable left edge instead of a tiny dot.
        borderLeft: `3px solid ${toneAccent[prompt.tone] ?? "var(--text)"}`,
      }}
    >
      <p
        className="min-w-0 text-[0.92rem] leading-[1.55]"
        style={{ color: "var(--text)" }}
      >
        {prompt.text}
      </p>
      <Link
        href={prompt.href}
        className="mt-2 inline-flex items-center gap-1 text-[0.8rem] font-medium sm:mt-0 sm:justify-self-end"
        style={{ color: "var(--text-muted)" }}
      >
        {prompt.ctaLabel}
        <ArrowRight />
      </Link>
    </li>
  );
}
