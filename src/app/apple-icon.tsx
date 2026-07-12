import { ImageResponse } from "next/og";

// Generated 180×180 apple-touch-icon — the home-screen tile on iOS.
// Same mark as src/app/icon.tsx.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#37352F",
          color: "#FAFAF8",
          fontSize: 120,
          fontWeight: 600,
          letterSpacing: "-0.04em",
        }}
      >
        <span style={{ marginTop: -14 }}>a</span>
        <span style={{ color: "#DE6B2A", marginTop: -14 }}>.</span>
      </div>
    ),
    size,
  );
}
