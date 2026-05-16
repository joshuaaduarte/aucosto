"use client";

import { useEffect, useState, type ReactNode } from "react";

export function Parallax({
  children,
  speed = 0.08,
  className = "",
}: {
  children?: ReactNode;
  speed?: number;
  className?: string;
}) {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const onScroll = () => setOffset(window.scrollY * speed);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [speed]);

  return (
    <div
      className={className}
      style={{ transform: `translate3d(0, ${offset}px, 0)` }}
    >
      {children}
    </div>
  );
}
