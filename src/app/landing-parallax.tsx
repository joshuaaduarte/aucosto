"use client";

import { useEffect, useState, type ReactNode } from "react";

export function Parallax({
  children,
  speed = 0.08,
  className = "",
  minWidth = 1024,
}: {
  children?: ReactNode;
  speed?: number;
  className?: string;
  minWidth?: number;
}) {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const media = window.matchMedia(`(min-width: ${minWidth}px)`);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const onScroll = () => {
      if (!media.matches || reducedMotion.matches) {
        setOffset(0);
        return;
      }
      setOffset(window.scrollY * speed);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    media.addEventListener?.("change", onScroll);
    reducedMotion.addEventListener?.("change", onScroll);

    return () => {
      window.removeEventListener("scroll", onScroll);
      media.removeEventListener?.("change", onScroll);
      reducedMotion.removeEventListener?.("change", onScroll);
    };
  }, [speed, minWidth]);

  return (
    <div
      className={className}
      style={{ transform: offset === 0 ? undefined : `translate3d(0, ${offset}px, 0)` }}
    >
      {children}
    </div>
  );
}
