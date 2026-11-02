import Link from "next/link";
import { isGoogleSignInConfigured } from "@/lib/auth-providers";
import { findInviteByToken } from "@/lib/household";
import { GoogleButton } from "@/app/login/google-button";
import { joinWithGoogle } from "./actions";
import { JoinForm } from "./join-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Join household · aucosto" };

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await findInviteByToken(token);
  const google = isGoogleSignInConfigured();

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-6 py-16"
      style={{ backgroundColor: "var(--bg-app)", color: "var(--text)" }}
    >
      <div className="fade-in w-full max-w-[360px] space-y-6">
        <p className="text-center text-[1.25rem] font-semibold tracking-tight">aucosto</p>
        {!invite || invite.status !== "valid" ? (
          <div className="space-y-3 text-center">
            <h1 className="text-[1.125rem] font-semibold">This invite link doesn&apos;t work</h1>
            <p className="text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
              {invite?.status === "accepted"
                ? "It was already used. Sign in instead."
                : invite?.status === "expired"
                  ? "It expired. Ask for a new invite."
                  : "Check that you copied the whole link, or ask for a new one."}
            </p>
            <Link href="/login" className="btn-ghost inline-flex">
              Go to sign in
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <h1 className="text-[1.125rem] font-semibold tracking-tight">
                Join {invite.householdName}
              </h1>
              <p className="text-[0.8125rem]" style={{ color: "var(--text-muted)" }}>
                You&apos;re invited as {invite.email}. You&apos;ll share Finance and Home.
              </p>
            </div>
            {google ? (
              <>
                <form action={joinWithGoogle}>
                  <GoogleButton label="Continue with Google" />
                </form>
                <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
                  Use the Google account for {invite.email}. Or set a password instead:
                </p>
              </>
            ) : null}
            <JoinForm token={token} email={invite.email} />
          </>
        )}
      </div>
    </div>
  );
}
