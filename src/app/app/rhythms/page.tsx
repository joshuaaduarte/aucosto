// Rhythms is no longer a standalone tool — it lives on the hub as contextual
// morning/bedtime check-in cards (see _components/rhythm-hub-card.tsx). This
// route is kept only to redirect any stale links back to the hub.

import { redirect } from "next/navigation";

export default function RhythmsPage() {
  redirect("/app");
}
