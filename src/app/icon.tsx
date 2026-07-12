import { ImageResponse } from "next/og";

// Generated 512×512 app icon (manifest + favicon fallback). Mirrors the
// in-app workspace mark: warm near-black tile, lowercase "a", orange accent
// period. Full-bleed square — iOS/Android round the corners themselves.
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
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
          fontSize: 340,
          fontWeight: 600,
          letterSpacing: "-0.04em",
        }}
      >
        <span style={{ marginTop: -40 }}>a</span>
        <span style={{ color: "#DE6B2A", marginTop: -40 }}>.</span>
      </div>
    ),
    size,
  );
}
