# Clerk Migration Plan (Planning Doc — Not Yet Implemented)

> **Status: PROPOSAL / FUTURE.** No auth code has been changed. The current Auth.js v5
> setup works and is fine to keep. This doc captures *how* we'd migrate to Clerk if/when
> we decide the tradeoff is worth it. Treat migrating as optional.

---

## 1. Current auth (what's in place today)

aucosto authenticates with **Auth.js v5 beta** (`next-auth`), Credentials provider, JWT
session strategy, with the Prisma adapter present. The config is deliberately **split into
two files** (load-bearing — do not merge them):

- **`src/auth.config.ts`** — edge-safe config. No DB, no bcrypt, no secret-bearing
  providers. Holds the `authorized` / `jwt` / `session` callbacks. The `authorized`
  callback redirects unauthed `/app/*` → `/login` and bounces logged-in users off
  `/login`. Imported by `src/proxy.ts` (must stay edge-safe so the middleware can run at
  the edge).
- **`src/auth.ts`** — full config. Adds `PrismaAdapter(prisma)` and the `Credentials`
  provider whose `authorize()` does
  `prisma.user.findUnique({ where: { email } })` then
  `bcrypt.compare(password, user.password)`. Exports `{ handlers, signIn, signOut, auth }`.

Wiring:

- **`src/proxy.ts`** — the Next.js 16 middleware (renamed from `middleware.ts`;
  Next 16 requires the file to be `proxy.ts` and to export a `proxy` or default function).
  It wraps `NextAuth(authConfig).auth(...)`, runs the `authorized` callback at the edge
  for every non-static request, and stamps an `x-request-id` header.
  Matcher: `["/((?!api|_next/static|_next/image|favicon.ico).*)"]`.
- **`src/app/api/auth/[...nextauth]/route.ts`** — exports the NextAuth handlers.
- **`src/app/login/`** — `page.tsx`, `login-form.tsx` (client, `useActionState`),
  `actions.ts` (server action calling `signIn`).
- **`session.user.id`** is set by the `jwt`/`session` callbacks and typed in
  `src/types/next-auth.d.ts`.

How the rest of the app consumes identity (this is the important part for the migration):

- **`src/lib/viewer-context.ts`** wraps `auth()` and is the single entry point app code
  uses for "who is looking". It returns
  `{ ownerUserId, effectiveUserId, financeVisible, appLockEnabled, isUnlocked, isDemoMode, ... }`.
- **Demo mode** swaps `effectiveUserId` to a shadow demo user via a cookie.
- **Privacy lock** gates the app behind an unlock screen.
- **Every service-layer function takes `userId` as its first argument and filters all
  queries by it.** `userId` is the Prisma `User.id` (a cuid). This is threaded through the
  entire codebase.
- `resolveActiveUserId()` (in viewer-context) is the chokepoint that produces that id.

**User model:** single user (Josh), seeded via `npm run db:seed` from `SEED_USER_*` env
vars. The `User` row holds a bcrypt `password`. The standard Auth.js adapter models
(`User`, `Account`, `Session`, `VerificationToken`) live in `prisma/schema/core.prisma`.

The key architectural fact: **identity flows through exactly one chokepoint
(`viewer-context.ts` / `resolveActiveUserId()`), and everything downstream is keyed on the
Prisma `User.id`.** That chokepoint is what makes this migration small.

---

## 2. What Clerk is and why (maybe) migrate

[Clerk](https://clerk.com) is a managed authentication provider. It supplies hosted/embeddable
sign-in UI, session management, MFA, social login, passkeys, and a user dashboard — so the
app no longer owns password hashing, session cookies, or the login form.

**Potential upside for aucosto:**

- Deletes custom auth surface: the Credentials provider, bcrypt, the JWT/session callbacks,
  the hand-rolled login form + server action, and the `[...nextauth]` route all go away.
- Offloads password & session security to a vendor whose job is to get it right.
- Free upgrades to MFA / passkeys / social login if we ever want them — no code to write.

**The honest tradeoff (why this is optional):**

- It adds a **third-party runtime dependency and vendor lock-in** for what is currently a
  **single-user app**. Auth.js already works and costs nothing.
- Clerk's free tier is generous but it's still an external service that can have outages,
  pricing changes, or API churn.
- For one user, the security win is marginal — we're not defending a fleet of accounts.

**Recommendation:** keep Auth.js for now. Migrate only if we want passkeys/MFA without
building them, or to stop maintaining auth code. This doc makes that migration a
~half-day job when we want it.

---

## 3. Allowlist — admit exactly one user

Because this is a single-user app, Clerk must **only ever admit
`joshua.duarte151@gmail.com`.** Use defense in depth — do both:

### 3a. Clerk dashboard allowlist (primary gate)

In the Clerk dashboard: **User & Authentication → Restrictions**:

1. Enable **Allowlist** and add `joshua.duarte151@gmail.com`.
2. Enable **Restrict sign-ups** (a.k.a. block sign-ups from non-allowlisted addresses).

This stops anyone else from creating an account at Clerk's edge before they ever reach the
app.

### 3b. App-side identity check (defense in depth)

Don't trust the dashboard setting alone. Reject any session whose email isn't the allowed
address, both in middleware and at the viewer-context chokepoint. Centralize the constant:

```ts
// src/lib/allowed-user.ts
export const ALLOWED_EMAIL = "joshua.duarte151@gmail.com";
```

In middleware (see §4) after `auth.protect()`, and again in `viewer-context.ts` when
resolving the user, compare `sessionClaims.email` (or `currentUser().primaryEmailAddress`)
against `ALLOWED_EMAIL` and treat any mismatch as unauthenticated (sign out / 403). If Clerk
ever misconfigures, the app still refuses to serve data to a stranger.

---

## 4. Step-by-step migration plan (for this codebase)

> Order matters: do the Prisma `clerkId` column + backfill **before** flipping the
> middleware, or Josh locks himself out (see §5).

### Step 0 — Prep Clerk + schema (no app behavior change yet)

1. Create the Clerk application; set the dashboard allowlist (§3a).
2. Add the `clerkId` column to `User` (this is the linchpin of the ID mapping, §4f):

   ```prisma
   // prisma/schema/core.prisma — User model
   clerkId   String?  @unique
   ```

   Run `npm run db:migrate`. (Leave the existing `password` column in place for now; it
   becomes vestigial but dropping it is a separate, later cleanup.)
3. Create Josh's Clerk user (dashboard → Users → Create, or have him sign up once the
   allowlist is on). Note his Clerk id (`user_...`).
4. **Backfill:** write his Clerk id onto his existing Prisma `User` row so all existing
   data (keyed on the cuid `User.id`) stays linked. One-time script:

   ```ts
   // scripts/link-clerk-id.ts  — run: tsx --env-file=.env scripts/link-clerk-id.ts
   import { prisma } from "@/lib/prisma";
   const EMAIL = "joshua.duarte151@gmail.com";
   const CLERK_ID = process.env.CLERK_ID!; // pass the user_... id
   await prisma.user.update({ where: { email: EMAIL }, data: { clerkId: CLERK_ID } });
   ```

   (Alternatively wire a Clerk `user.created` webhook that upserts `clerkId` by email — but
   for one user the script is simpler and sufficient.)

### Step 1 — Install Clerk

```bash
npm install @clerk/nextjs
```

Leave `next-auth`, `@auth/prisma-adapter`, and `bcryptjs` installed until the very end
(Step 8) so rollback stays trivial.

### Step 2 — Env vars

Add to `.env` (and to Vercel project settings for production + preview):

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
# Keep the login route at /login:
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/login        # single-user: no real sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL=/app
NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL=/app
```

`AUTH_SECRET` stays (it's also used to encrypt Teller tokens in `src/lib/secrets.ts` — do
**not** remove it). `SEED_USER_*` can stay; the seed just stops setting a meaningful
password (§4g).

### Step 3 — Wrap the app in `ClerkProvider`

Wrap the body in the root layout:

```tsx
// src/app/layout.tsx
import { ClerkProvider } from "@clerk/nextjs";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
```

(Keep the existing `viewport-fit=cover` viewport export and any other root-layout config.)

### Step 4 — Replace middleware (`src/proxy.ts`)

Swap NextAuth for `clerkMiddleware`. **The file must stay named `proxy.ts` and export a
`proxy`/default function** (Next 16 requirement — unchanged). Preserve the `x-request-id`
stamping. Use Clerk's recommended matcher.

```ts
// src/proxy.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

const isProtected = createRouteMatcher(["/app(.*)"]);

export const proxy = clerkMiddleware(async (auth, req) => {
  if (isProtected(req)) {
    await auth.protect(); // redirects unauthed users to the sign-in URL (/login)
    // Defense-in-depth allowlist check:
    const { sessionClaims } = await auth();
    if (sessionClaims?.email && sessionClaims.email !== "joshua.duarte151@gmail.com") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }
  const res = NextResponse.next();
  res.headers.set("x-request-id", req.headers.get("x-request-id") ?? randomUUID());
  return res;
});

// Clerk's recommended matcher: skip Next internals + static files, always run on /api.
export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

> Note: `email` is only in `sessionClaims` if you add it to the JWT/session token in the
> Clerk dashboard (Sessions → Customize token: `{"email": "{{user.primary_email_address}}"}`).
> Otherwise use `currentUser()` in the viewer-context layer for the allowlist check instead.

The old `authorized`-callback behavior (redirect unauthed `/app/*` → `/login`, bounce
logged-in users off `/login`) is now covered by `auth.protect()` + the
`FORCE_REDIRECT_URL` env vars.

### Step 5 — Login page

Replace the custom form at `src/app/login/` with Clerk's `<SignIn />`, keeping the route at
`/login`:

```tsx
// src/app/login/[[...rest]]/page.tsx   (catch-all so Clerk can own sub-routes)
import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return <SignIn path="/login" />;
}
```

Delete `src/app/login/login-form.tsx` and `src/app/login/actions.ts` (the `signIn` server
action is no longer used).

### Step 6 — Remove NextAuth surface

Delete:

- `src/app/api/auth/[...nextauth]/route.ts` (and the empty `[...nextauth]` dir)
- `src/auth.ts`
- `src/auth.config.ts`
- `src/types/next-auth.d.ts`

### Step 7 — ID mapping & viewer-context (the critical part)

The whole app is keyed on the Prisma `User.id` (cuid), threaded through every service.
Clerk issues its **own** id (`user_...`). We must **not** rekey the data.

**Option A — map Clerk id → Prisma `User.id` at the chokepoint (RECOMMENDED).**
Resolve the Prisma `User.id` from `auth().userId` via the `clerkId` column we added in
Step 0. Only `viewer-context.ts` / `resolveActiveUserId()` changes; **every service,
widget, and query stays untouched** because they still receive the same cuid `userId`.

```ts
// src/lib/viewer-context.ts  (sketch of the localized change)
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

const ALLOWED_EMAIL = "joshua.duarte151@gmail.com";

async function resolveOwnerUserId(): Promise<string | null> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  // Defense-in-depth allowlist (in case dashboard restriction is ever off):
  const user = await currentUser();
  if (user?.primaryEmailAddress?.emailAddress !== ALLOWED_EMAIL) return null;

  const row = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true },
  });
  return row?.id ?? null; // <- this is the existing cuid every service expects
}
```

Demo mode and the privacy lock keep working unchanged: they layer on top of
`ownerUserId`/`effectiveUserId`, which still resolve to the same cuids. The demo-mode cookie
swap, `financeVisible`, `appLockEnabled`, `isUnlocked` logic is all downstream of
`resolveOwnerUserId()` and doesn't care that the upstream provider changed.

**Option B — rekey every table's `userId` to the Clerk id. REJECTED.** This means a data
migration across every tool table (time, finance, calendar, do, habits, projects, reflect,
events, …), all cross-tool FKs, and the `Account`/`Session` adapter rows — huge blast
radius, high risk, zero benefit. Don't.

**Bottom line:** `viewer-context.ts` is the single chokepoint. Update it (and the few
direct `auth()` callers, Step 8) and the rest of the app is inert to the swap.

### Step 8 — Update `auth()` call sites

Anywhere outside viewer-context that calls NextAuth's `await auth()` (e.g. some server
actions that resolve identity directly, the `/api/auth` route which is being deleted) must
switch to Clerk's `auth()` / `currentUser()` from `@clerk/nextjs/server`. Grep for
`from "@/auth"` and `auth()` usage and route them through `viewer-context` /
`resolveActiveUserId()` where possible, so the provider stays localized.

Then remove the unused deps:

```bash
npm uninstall next-auth @auth/prisma-adapter bcryptjs
```

(`@auth/prisma-adapter` / `bcryptjs` may not be exact package names in this repo — confirm
against `package.json` before uninstalling.)

### Step 9 — Seed

`npm run db:seed` no longer needs to set a bcrypt password. Josh is created in Clerk
(dashboard or first sign-up) and linked via `clerkId` (Step 0). The `User.password` column
becomes **vestigial** — leave it nullable, or drop it in a later cleanup migration. Update
`prisma/seed.ts` so it upserts the `User` row (for `clerkId` / profile fields) without a
password.

---

## 5. Risk: sessions invalidated on deploy

- **Switching providers logs Josh out.** Existing NextAuth JWT cookies become meaningless
  the moment the middleware stops reading them. He must re-sign-in through Clerk after
  cutover. (Single user, so this is one inconvenience, not an incident.)
- **The `clerkId` backfill must land before or at cutover.** If the middleware flips to
  Clerk but no `User` row has a matching `clerkId`, `resolveOwnerUserId()` returns `null`
  and Josh is locked out of his own data even though he's "logged in" at Clerk. Do Step 0's
  backfill first and verify the row has the `clerkId` set.
- **Test on a Vercel preview deploy first.** Point a preview at Clerk's dev keys, sign in,
  confirm `/app` loads real data (i.e. the cuid resolved correctly), confirm a non-allowed
  email is rejected, then promote.
- **Rollback = revert the commit.** All the Auth.js code lives in git history, so reverting
  the migration commit restores the working setup (then redeploy). Keep
  `next-auth`/`bcryptjs` installed until the preview test passes (Step 8 is last) so revert
  doesn't also need a `npm install`.

---

## 6. Effort estimate

Realistically **~3–5 hours** for a careful single-user migration:

| Chunk | Est. |
|---|---|
| Clerk app + allowlist, `ClerkProvider`, middleware, login page | ~1h |
| `clerkId` column + viewer-context mapping + backfill script | ~1–2h |
| Testing on a preview deploy (sign-in, data resolves, allowlist rejects) | ~1h |
| Cleanup: remove `next-auth`/`bcryptjs`, delete old files, seed tweak | ~0.5h |

**Low complexity overall** because it's a single user — there's no multi-tenant data
migration. The **only real risk is the `userId` ↔ `clerkId` mapping**; get the `clerkId`
backfill right and confine the provider swap to `viewer-context.ts`, and everything else
(services keyed on the cuid `userId`) is untouched.
