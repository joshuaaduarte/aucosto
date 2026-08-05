"use client";

import { useState } from "react";

type LocationSnapshot = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  capturedAt: string;
};

const LOCATION_KEY = "aucosto.location.last";

function readLocation(): LocationSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LOCATION_KEY);
    return raw ? (JSON.parse(raw) as LocationSnapshot) : null;
  } catch {
    return null;
  }
}

function formatLocation(snapshot: LocationSnapshot | null) {
  if (!snapshot) return "No browser check-in yet.";
  const captured = new Date(snapshot.capturedAt).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const accuracy =
    snapshot.accuracy === null ? "" : `, accuracy about ${Math.round(snapshot.accuracy)}m`;
  return `${snapshot.latitude.toFixed(5)}, ${snapshot.longitude.toFixed(5)} (${captured}${accuracy})`;
}

export function LocationPanel() {
  const [locationSnapshot, setLocationSnapshot] = useState<LocationSnapshot | null>(() =>
    readLocation(),
  );
  const [status, setStatus] = useState("Ready.");
  const [busy, setBusy] = useState(false);

  async function captureLocation() {
    if (!("geolocation" in navigator)) {
      setStatus("This browser does not support location check-ins.");
      return;
    }

    setBusy(true);
    setStatus("Checking current location...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const snapshot: LocationSnapshot = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: Number.isFinite(position.coords.accuracy)
            ? position.coords.accuracy
            : null,
          capturedAt: new Date().toISOString(),
        };
        localStorage.setItem(LOCATION_KEY, JSON.stringify(snapshot));
        setLocationSnapshot(snapshot);
        setStatus("Location check-in saved on this device.");
        setBusy(false);
      },
      (error) => {
        setStatus(error.message || "Location check-in failed.");
        setBusy(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
        This captures your current location only when you tap the button. For
        background place signals, use the iOS Shortcuts geofence setup.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={captureLocation} disabled={busy} className="btn-ink">
          {busy ? "Checking..." : "Check location"}
        </button>
      </div>
      <div
        className="rounded-md px-3 py-2 text-[0.8125rem]"
        style={{ background: "var(--bg-tint)", color: "var(--text-muted)" }}
      >
        <p>{formatLocation(locationSnapshot)}</p>
        <p className="mt-1">{status}</p>
      </div>
    </div>
  );
}
