"use client";

// Settings → Notifications: enable/disable Web Push on this device and send
// a test. On iOS this only works from the installed home-screen app (Safari
// tabs can't receive pushes), so the panel says so instead of erroring.

import { useEffect, useState } from "react";

type PanelState =
  | { phase: "loading" }
  | { phase: "unsupported"; reason: string }
  | { phase: "server-disabled" }
  | {
      phase: "ready";
      publicKey: string;
      subscribed: boolean;
      devices: number;
    };

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function isIosSafariTab(): boolean {
  const ua = navigator.userAgent;
  const isIos = /iPhone|iPad|iPod/.test(ua);
  const standalone =
    "standalone" in navigator &&
    (navigator as { standalone?: boolean }).standalone === true;
  const displayModeStandalone = window.matchMedia(
    "(display-mode: standalone)",
  ).matches;
  return isIos && !standalone && !displayModeStandalone;
}

export function NotificationsPanel() {
  const [state, setState] = useState<PanelState>({ phase: "loading" });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setState({
          phase: "unsupported",
          reason: isIosSafariTab()
            ? "On iPhone, notifications only work from the installed app — add aucosto to your home screen first (Share → Add to Home Screen), then enable them there."
            : "This browser doesn't support Web Push.",
        });
        return;
      }
      try {
        const res = await fetch("/api/push");
        const data = (await res.json()) as {
          enabled: boolean;
          publicKey: string | null;
          devices: number;
        };
        if (cancelled) return;
        if (!data.enabled || !data.publicKey) {
          setState({ phase: "server-disabled" });
          return;
        }
        const registration = await navigator.serviceWorker.register("/sw.js");
        const subscription = await registration.pushManager.getSubscription();
        if (cancelled) return;
        setState({
          phase: "ready",
          publicKey: data.publicKey,
          subscribed: Boolean(subscription),
          devices: data.devices,
        });
      } catch {
        if (!cancelled) {
          setState({ phase: "unsupported", reason: "Couldn't reach the push service." });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    if (state.phase !== "ready" || busy) return;
    setBusy(true);
    setNote(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setNote("Notifications were blocked — allow them in device settings to enable.");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(state.publicKey).buffer as ArrayBuffer,
      });
      const json = subscription.toJSON();
      const res = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "subscribe",
          endpoint: subscription.endpoint,
          keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
        }),
      });
      if (!res.ok) throw new Error("subscribe failed");
      setState({ ...state, subscribed: true, devices: state.devices + 1 });
      setNote("Notifications enabled on this device.");
    } catch {
      setNote("Couldn't enable notifications — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (state.phase !== "ready" || busy) return;
    setBusy(true);
    setNote(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "unsubscribe",
            endpoint: subscription.endpoint,
          }),
        });
        await subscription.unsubscribe();
      }
      setState({
        ...state,
        subscribed: false,
        devices: Math.max(0, state.devices - 1),
      });
      setNote("Notifications disabled on this device.");
    } catch {
      setNote("Couldn't disable notifications — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    if (busy) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test" }),
      });
      const data = (await res.json()) as { sent?: number };
      setNote(
        data.sent
          ? `Test sent to ${data.sent} device${data.sent === 1 ? "" : "s"}.`
          : "No subscribed devices received it — enable notifications first.",
      );
    } catch {
      setNote("Couldn't send the test.");
    } finally {
      setBusy(false);
    }
  }

  if (state.phase === "loading") {
    return (
      <p className="text-[0.8125rem]" style={{ color: "var(--text-faint)" }}>
        Checking notification support…
      </p>
    );
  }

  if (state.phase === "unsupported") {
    return (
      <p className="text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
        {state.reason}
      </p>
    );
  }

  if (state.phase === "server-disabled") {
    return (
      <p className="text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
        Push isn&apos;t configured on the server — set{" "}
        <code className="font-mono text-[0.75rem]">VAPID_PUBLIC_KEY</code> /{" "}
        <code className="font-mono text-[0.75rem]">VAPID_PRIVATE_KEY</code> in
        the environment.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
        Morning check-in and evening reflection nudges, sent only when you
        haven&apos;t already done them.
        {state.devices > 0
          ? ` ${state.devices} device${state.devices === 1 ? "" : "s"} enabled.`
          : ""}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {state.subscribed ? (
          <button type="button" onClick={disable} disabled={busy} className="btn-ghost">
            {busy ? "…" : "Disable on this device"}
          </button>
        ) : (
          <button type="button" onClick={enable} disabled={busy} className="btn-ink">
            {busy ? "…" : "Enable notifications"}
          </button>
        )}
        <button type="button" onClick={sendTest} disabled={busy} className="btn-ghost">
          Send test
        </button>
      </div>
      {note ? (
        <p
          className="rounded-md px-3 py-2 text-[0.8125rem]"
          style={{ background: "var(--bg-tint)", color: "var(--text-muted)" }}
        >
          {note}
        </p>
      ) : null}
    </div>
  );
}
