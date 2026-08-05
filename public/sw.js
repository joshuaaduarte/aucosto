// aucosto service worker - Web Push plus same-device reminder tests.
//
// Deliberately NO fetch handler / caching: a stale-cache bug on a personal
// dashboard is worse than requiring a connection. This file exists so the
// installed app can receive pushes (iOS requires the app to be added to the
// home screen for push to work at all).

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = { title: "Aucosto", body: "", url: "/app" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // Non-JSON payload - fall back to the defaults.
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/apple-icon",
      badge: "/apple-icon",
      data: { url: payload.url },
    }),
  );
});

self.addEventListener("message", (event) => {
  if (!event.data || event.data.type !== "AUCOSTO_REMINDER") return;

  event.waitUntil(
    self.registration.showNotification(event.data.title || "Open Aucosto", {
      body:
        event.data.body ||
        "Check the hub, confirm your timer, and choose the next task.",
      tag: "aucosto-use-reminder",
      renotify: true,
      icon: "/apple-icon",
      badge: "/apple-icon",
      data: { url: event.data.url || "/app" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(
    event.notification.data?.url || "/app",
    self.location.origin,
  ).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (client.url.startsWith(self.location.origin) && "focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        return self.clients.openWindow(targetUrl);
      }),
  );
});
