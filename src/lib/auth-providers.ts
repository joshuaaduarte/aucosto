// Which sign-in methods are configured. Env-only, safe to call from Server
// Components that decide whether to render a "Continue with Google" button.
//
// Google sign-in turns on when AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET are set
// (Auth.js reads those names automatically). See docs/household.md.

export function isGoogleSignInConfigured(): boolean {
  return Boolean(
    process.env.AUTH_GOOGLE_ID?.trim() && process.env.AUTH_GOOGLE_SECRET?.trim(),
  );
}
