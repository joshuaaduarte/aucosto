"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    // Defer to next frame — keeps setState out of the synchronous effect body
    // and satisfies react-hooks/set-state-in-effect
    const id = requestAnimationFrame(() => {
      const stored = localStorage.getItem("aucosto-theme") as "light" | "dark" | null;
      const resolved =
        stored ??
        (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      setTheme(resolved);
    });
    return () => cancelAnimationFrame(id);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("aucosto-theme", next);
  }

  if (theme === null) return <div className="h-8 w-8" aria-hidden />;

  return (
    <button
      onClick={toggle}
      className="flex h-8 w-8 items-center justify-center rounded-md text-ink-fade transition-colors hover:bg-paper-deep hover:text-ink"
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
      <circle cx="7.5" cy="7.5" r="2.5" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M7.5 1.5V3M7.5 12V13.5M1.5 7.5H3M12 7.5H13.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M3.5 3.5L4.5 4.5M10.5 10.5L11.5 11.5M11.5 3.5L10.5 4.5M4.5 10.5L3.5 11.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
      <path
        d="M12.5 8.5a5.5 5.5 0 0 1-7.3-7.3A5.5 5.5 0 1 0 12.5 8.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
