"use server";

import { cookies } from "next/headers";
import { signOut } from "@/auth";
import { DEMO_MODE_COOKIE } from "@/lib/viewer-context";

export async function logout() {
  const cookieStore = await cookies();
  // Clear the retired app-lock cookie too, for browsers that still hold it.
  cookieStore.delete("aucosto_app_unlock");
  cookieStore.delete(DEMO_MODE_COOKIE);
  await signOut({ redirectTo: "/" });
}
