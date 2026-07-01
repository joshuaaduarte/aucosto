// Shared inline SVG icons for the hub page sections.

const ip = {
  width: 14,
  height: 14,
  viewBox: "0 0 15 15",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.25,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function ClockIcon() {
  return (
    <svg {...ip}>
      <circle cx="7.5" cy="7.5" r="5.5" />
      <path d="M7.5 4.5V7.5l2 1.25" />
    </svg>
  );
}

export function WalletIcon() {
  return (
    <svg {...ip}>
      <path d="M2 5.5C2 4.67 2.67 4 3.5 4H12a1 1 0 0 1 1 1v6.5c0 .83-.67 1.5-1.5 1.5h-8A1.5 1.5 0 0 1 2 11.5V5.5Z" />
      <path d="M10 8.25h2.5" />
    </svg>
  );
}

export function CalendarIcon() {
  return (
    <svg {...ip}>
      <rect x="2" y="3" width="11" height="10" rx="1.5" />
      <path d="M2 6h11M5 1.75v2.5M10 1.75v2.5" />
    </svg>
  );
}

export function ListIcon() {
  return (
    <svg {...ip}>
      <path d="M5 4h8M5 7.5h8M5 11h5" />
      <circle cx="2.5" cy="4" r="0.6" fill="currentColor" />
      <circle cx="2.5" cy="7.5" r="0.6" fill="currentColor" />
      <circle cx="2.5" cy="11" r="0.6" fill="currentColor" />
    </svg>
  );
}

export function RepeatIcon() {
  return (
    <svg {...ip}>
      <path d="M3 4.5h6.5a2.5 2.5 0 0 1 0 5H8.5" />
      <path d="M9.5 2.75 11.25 4.5 9.5 6.25" />
      <path d="M6.5 10.5H4a2.5 2.5 0 0 1 0-5h1" />
      <path d="M3.5 8.75 1.75 10.5 3.5 12.25" />
    </svg>
  );
}

export function ConnectionIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="3" cy="3" r="1.5" />
      <circle cx="10" cy="10" r="1.5" />
      <path d="M4.4 4.4 8.6 8.6" />
    </svg>
  );
}

export function ArrowRight() {
  return (
    <svg width="11" height="11" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2.5 6.5h8M7 3l3.5 3.5L7 10" />
    </svg>
  );
}

export function SparkIcon() {
  return (
    <svg {...ip}>
      <path d="M7.5 2.25 8.7 5.4l3.05 1.2-3.05 1.2-1.2 3.15-1.2-3.15-3.05-1.2 3.05-1.2 1.2-3.15Z" />
    </svg>
  );
}
