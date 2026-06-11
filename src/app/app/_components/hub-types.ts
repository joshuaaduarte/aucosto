// Shared types and tone palette for the hub page sections.

export const toneAccent: Record<string, string> = {
  amber: "var(--accent)",
  sky: "var(--text)",
  emerald: "var(--text)",
  zinc: "var(--text-faint)",
};

export type TopAction = {
  href: string;
  label: string;
  detail: string;
};

export type FocusModule = {
  eyebrow: string;
  title: string;
  body: string;
  primary: TopAction;
  secondary?: TopAction;
};

export type ConnectionItem = {
  tone: "sky" | "amber" | "emerald" | "zinc";
  title: string;
  body: string;
  href: string;
  ctaLabel: string;
};
