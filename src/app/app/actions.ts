"use server";

import { cookies } from "next/headers";
import { signOut } from "@/auth";
import { APP_UNLOCK_COOKIE, DEMO_MODE_COOKIE } from "@/lib/viewer-context";

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(APP_UNLOCK_COOKIE);
  cookieStore.delete(DEMO_MODE_COOKIE);
  await signOut({ redirectTo: "/" });
}
