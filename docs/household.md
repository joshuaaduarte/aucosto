# Household access (shared Finance + Home)

A second person (a partner) gets their own login that opens **Finance** and
**Home** only. The owner's personal tools (time, do, habits, calendar,
reflect, rhythms, work, rolodex, insights, assistant) stay private.

## How it works

- **Household = a shadow data user.** `Household.dataUserId` is a User row
  with no password (it can never sign in) that owns the shared finance and
  home rows. This is the demo-workspace trick: every service already scopes by
  `userId`, so finance (accounts, Teller sync, webhooks, unique constraints)
  and Home work on the household without a service rewrite.
- **Viewer context picks the scope per tool** (`src/lib/viewer-context.ts`):
  `effectiveUserId` (personal tools: the viewer, or demo), `financeUserId`
  (household or "Just me", switched by the `aucosto_finance_scope` cookie),
  `homeUserId` (household when there is one).
- **Partner access.** `HouseholdMember.role = "partner"`. The app layout
  redirects partners away from anything except `/app/home`, `/app/finance`
  and `/app/settings` (path from the `x-pathname` header the proxy stamps).
  The privacy guarantee does not depend on that redirect: a partner's
  personal-tool scope is their own empty userId, so nothing of the owner's
  can be read even if a page were reached. The assistant API refuses partner
  sessions; personal push nudges skip partners.
- **Attribution.** Actions on shared data run inside `runAsActor()`
  (`src/lib/actor.ts`), so `recordEvent()` stamps `meta.actorUserId`. Home
  rows also keep `addedByUserId` / `lastDoneByUserId`.
- **Removing access** sets `HouseholdMember.removedAt`. Their next page load
  shows "access removed" (JWT sessions can't be revoked, but viewer context
  reads the DB every request).
- **No columns were added to existing tables.** If the SQL below hasn't run,
  sign-in and every personal tool work exactly as before; Household/Home show
  a "run the SQL" notice and budgets/bills read as empty.

## Setup (production)

1. Apply the tables over `DIRECT_URL` (before or right after the deploy):

   ```bash
   npx tsx --env-file=.env scripts/apply-sql.ts scripts/create-household-home.sql
   npm run db:generate
   ```

   Idempotent; safe to re-run. (Run the older
   `scripts/consolidate-runtime-ddl.sql` first if it's still pending.)

2. **Google sign-in (optional but recommended).** Email + password sign-in
   always stays available.
   1. Go to <https://console.cloud.google.com/> → create (or pick) a project.
   2. *APIs & Services → OAuth consent screen*: External, app name
      "aucosto", your email as support/developer contact. Add yourself and
      your partner as **test users** (or publish the app; only basic profile
      scopes are used, so no review is needed).
   3. *APIs & Services → Credentials → Create credentials → OAuth client ID*:
      type **Web application**. Authorized redirect URIs:
      `https://aucosto.com/api/auth/callback/google` (and
      `http://localhost:3000/api/auth/callback/google` for dev).
   4. Copy the client ID and secret into Vercel (Production) and `.env`:
      `AUTH_GOOGLE_ID=...`, `AUTH_GOOGLE_SECRET=...`. Redeploy.

   The "Continue with Google" button appears only when both are set. Only
   emails that already have an account or hold a live invite can sign in
   with Google; anyone else is sent back to /login with "isn't invited".
   Your Google email must match your aucosto email to land in your account.

3. In the app: **Settings → Household → Set up household**, then
   **Move to household** for the accounts you share (a linked bank moves with
   all of its accounts; anything you leave stays in "Just me").

4. **Invite**: Settings → Household → enter her email → copy the link and
   send it. It works once and expires in 7 days. She can continue with
   Google (same email) or set a password.

## Files

| Piece | File |
|---|---|
| Schema | `prisma/schema/household.prisma`, `home.prisma`, `FinanceBudget`/`FinanceBill` in `finance.prisma` |
| SQL | `scripts/create-household-home.sql` |
| Membership, invites, data user | `src/lib/household.ts` (infra, guarded reads) |
| Pure rules | `src/lib/household-access.ts`, `src/lib/home.ts`, `src/lib/finance-planning.ts` |
| Auth | `src/auth.ts` (Google provider, invite-only `signIn`, invite acceptance in `jwt`), `src/lib/auth-providers.ts`, `src/app/join/[token]/` |
| Finance move | `src/lib/services/finance/transfer.ts` |
| Budgets, bills, money date | `src/lib/services/finance/planning.ts`, `src/app/app/finance/_components/household-planning-section.tsx` |
| Home tool | `src/lib/services/home.ts`, `src/app/app/home/`, `src/lib/widgets/home.tsx` |
| Settings | `src/app/app/settings/household-panel.tsx`, `password-panel.tsx`, `household-actions.ts` |
| Household push | `/api/cron/nudges` morning slot ("Home today") |
