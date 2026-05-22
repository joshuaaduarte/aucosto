"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
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

  if (theme === null) return <div className="h-7 w-7" aria-hidden />;

  return (
    <button
      onClick={toggle}
      className="btn-icon"
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="7.5" cy="7.5" r="2.5" />
      <path d="M7.5 1.75V3M7.5 12v1.25M1.75 7.5H3M12 7.5h1.25" />
      <path d="M3.5 3.5l1 1M10.5 10.5l1 1M11.5 3.5l-1 1M4.5 10.5l-1 1" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" aria-hidden>
      <path d="M12.5 8.5a5.5 5.5 0 0 1-7.3-7.3A5.5 5.5 0 1 0 12.5 8.5Z" />
    </svg>
  );
}
