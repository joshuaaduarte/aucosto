import type { Metadata, Viewport } from "next";
import { Inter_Tight, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Aucosto | Personal workspace",
  description: "A personal workspace for time, money, calendar, and daily life.",
  applicationName: "Aucosto",
  // Installed-app (Add to Home Screen) behavior on iOS: run standalone
  // without Safari chrome, extend under the status bar (black-translucent —
  // the mobile header pads itself with --safe-area-top to compensate).
  appleWebApp: {
    capable: true,
    title: "Aucosto",
    statusBarStyle: "black-translucent",
  },
};

// viewport-fit=cover lets env(safe-area-inset-*) resolve on notched phones
// (used by the bottom-sheet modals to clear the home indicator).
// themeColor tints the browser/status-bar chrome to match the app surface.
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFAF8" },
    { media: "(prefers-color-scheme: dark)", color: "#191919" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${interTight.variable} ${jetbrains.variable} h-full antialiased`}
      // The beforeInteractive theme script sets data-theme from localStorage
      // before hydration — an intentional, attribute-level mismatch.
      suppressHydrationWarning
    >
      <head>
        <Script id="aucosto-theme-init" strategy="beforeInteractive">
          {`try{var t=localStorage.getItem("aucosto-theme");if(t)document.documentElement.setAttribute("data-theme",t)}catch(e){}`}
        </Script>
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
