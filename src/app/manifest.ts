import type { MetadataRoute } from "next";

// Web app manifest — makes aucosto installable as a home-screen app
// (iOS "Add to Home Screen" / Android install prompt). start_url points at
// the hub so launching from the home screen lands on the morning check-in,
// not the marketing page. Icons are generated at request time by
// src/app/icon.tsx and src/app/apple-icon.tsx.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aucosto",
    short_name: "Aucosto",
    description:
      "A personal workspace for time, money, calendar, and daily life.",
    id: "/app",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#191919",
    theme_color: "#191919",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
