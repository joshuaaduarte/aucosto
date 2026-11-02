"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { acceptInviteWithPassword } from "@/lib/household";
import { PARTNER_HOME_PATH } from "@/lib/household-access";

export type JoinState = { error?: string } | undefined;

export async function joinWithPassword(
  token: string,
  _prev: JoinState,
  formData: FormData,
): Promise<JoinState> {
  const password = String(formData.get("password") ?? "");
  if (password !== String(formData.get("confirm") ?? "")) {
    return { error: "The passwords don't match." };
  }
  let email: string;
  try {
    ({ email } = await acceptInviteWithPassword({
      token,
      name: String(formData.get("name") ?? ""),
      password,
    }));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not accept the invite." };
  }
  try {
    await signIn("credentials", { email, password, redirectTo: PARTNER_HOME_PATH });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Your account is ready. Sign in from the login page." };
    }
    throw error; // redirect
  }
}

export async function joinWithGoogle(): Promise<void> {
  // The invite is matched by email in the sign-in callback.
  await signIn("google", { redirectTo: PARTNER_HOME_PATH });
}
