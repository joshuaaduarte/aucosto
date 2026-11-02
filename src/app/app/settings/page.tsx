import { getViewerContext } from "@/lib/viewer-context";
import {
  getHouseholdMembership,
  listHouseholdInvites,
  listHouseholdMembers,
} from "@/lib/household";
import { isHomeReady } from "@/lib/services/home";
import { summarizeMovableFinance } from "@/lib/services/finance";
import { hasPassword } from "@/lib/services/user";
import { HouseholdPanel, type HouseholdPanelData } from "./household-panel";
import { PasswordPanel } from "./password-panel";
import { getWhoopConfig } from "@/lib/whoop";
import { getWhoopStatus } from "@/lib/services/whoop";
import { PrivacyPanel } from "../privacy-panel";
import { LocationPanel } from "./location-panel";
import { NotificationsPanel } from "./notifications-panel";
import { WhoopPanel } from "./whoop-panel";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ whoop?: string }>;
}) {
  const context = await getViewerContext();
  const { whoop: whoopFlag } = await searchParams;

  const isPartner = context?.role === "partner";
  const whoopConfigured = !isPartner && getWhoopConfig().enabled;
  const whoopStatus =
    context && whoopConfigured
      ? await getWhoopStatus(context.effectiveUserId)
      : { connected: false, lastSyncedAt: null, since: null };

  const household = context ? await loadHouseholdPanel(context) : null;
  const passwordSet = context ? await hasPassword(context.ownerUserId) : true;

  return (
    <div className="space-y-10">
      <header className="fade-in flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p
            className="text-[0.75rem] font-medium uppercase tracking-wider"
            style={{ color: "var(--text-faint)" }}
          >
            Settings
          </p>
          <h1
            className="mt-1 text-[1.5rem] font-bold tracking-tight sm:text-[1.875rem]"
            style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
          >
            Settings
          </h1>
        </div>
        <p
          className="text-[0.8125rem] sm:max-w-[38rem] sm:text-right"
          style={{ color: "var(--text-muted)" }}
        >
          {isPartner
            ? "Your household, sign-in and notifications."
            : "Household, sign-in, privacy and demo workspace controls."}
        </p>
      </header>

      {household ? (
        <Section id="household" eyebrow="Household" title="Who shares Finance and Home with you.">
          <HouseholdPanel data={household} />
        </Section>
      ) : null}

      <Section id="password" eyebrow="Sign-in" title="Your password.">
        <PasswordPanel hasPassword={passwordSet} />
      </Section>

      {isPartner ? null : (
      <section
        id="finance"
        className="rounded-md border p-5"
        style={{
          borderColor: "var(--border-soft)",
          background: "var(--bg-page)",
        }}
      >
        <p
          className="text-[0.6875rem] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-faint)" }}
        >
          Controls
        </p>
        <h2
          className="mt-1 text-[1rem] font-semibold tracking-tight"
          style={{ color: "var(--text)" }}
        >
          Manage what shows up in your workspace.
        </h2>
        <div className="mt-4">
          <PrivacyPanel
            financeVisible={context?.financeVisible ?? false}
            isDemoMode={context?.isDemoMode ?? false}
          />
        </div>
      </section>
      )}

      <section
        id="notifications"
        className="rounded-md border p-5"
        style={{
          borderColor: "var(--border-soft)",
          background: "var(--bg-page)",
        }}
      >
        <p
          className="text-[0.6875rem] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-faint)" }}
        >
          Notifications
        </p>
        <h2
          className="mt-1 text-[1rem] font-semibold tracking-tight"
          style={{ color: "var(--text)" }}
        >
          Morning and evening nudges on this device.
        </h2>
        <div className="mt-4">
          <NotificationsPanel />
        </div>
      </section>

      {isPartner ? null : (
      <>
      <section
        id="location"
        className="rounded-md border p-5"
        style={{
          borderColor: "var(--border-soft)",
          background: "var(--bg-page)",
        }}
      >
        <p
          className="text-[0.6875rem] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-faint)" }}
        >
          Location
        </p>
        <h2
          className="mt-1 text-[1rem] font-semibold tracking-tight"
          style={{ color: "var(--text)" }}
        >
          Foreground check-ins from this browser.
        </h2>
        <div className="mt-4">
          <LocationPanel />
        </div>
      </section>

      <section
        id="whoop"
        className="rounded-md border p-5"
        style={{
          borderColor: "var(--border-soft)",
          background: "var(--bg-page)",
        }}
      >
        <p
          className="text-[0.6875rem] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-faint)" }}
        >
          Whoop
        </p>
        <h2
          className="mt-1 text-[1rem] font-semibold tracking-tight"
          style={{ color: "var(--text)" }}
        >
          Auto-fill the morning check-in from your Whoop.
        </h2>
        <div className="mt-4">
          <WhoopPanel
            configured={whoopConfigured}
            connected={whoopStatus.connected}
            lastSyncedAt={whoopStatus.lastSyncedAt?.toISOString() ?? null}
            flag={whoopFlag ?? null}
          />
        </div>
      </section>
      </>
      )}
    </div>
  );
}

function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="rounded-md border p-5"
      style={{ borderColor: "var(--border-soft)", background: "var(--bg-page)" }}
    >
      <p
        className="text-[0.6875rem] font-semibold uppercase tracking-wider"
        style={{ color: "var(--text-faint)" }}
      >
        {eyebrow}
      </p>
      <h2 className="mt-1 text-[1rem] font-semibold tracking-tight" style={{ color: "var(--text)" }}>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

async function loadHouseholdPanel(
  context: NonNullable<Awaited<ReturnType<typeof getViewerContext>>>,
): Promise<HouseholdPanelData> {
  const ready = await isHomeReady(context.ownerUserId).catch(() => false);
  const membership = ready ? await getHouseholdMembership(context.ownerUserId) : null;
  const active = membership && !membership.removed ? membership : null;
  const [members, invites, personal, shared] = active
    ? await Promise.all([
        listHouseholdMembers(active.householdId),
        context.role === "owner" ? listHouseholdInvites(active.householdId) : Promise.resolve([]),
        context.financeVisible ? summarizeMovableFinance(context.ownerUserId) : Promise.resolve(null),
        context.financeVisible ? summarizeMovableFinance(active.dataUserId) : Promise.resolve(null),
      ])
    : [[], [], null, null];
  return {
    ready,
    role: context.role,
    isDemoMode: context.isDemoMode,
    household: active ? { name: active.householdName } : null,
    members: members.map((m) => ({ ...m, joinedAt: undefined })),
    invites: invites.map((invite) => ({
      id: invite.id,
      email: invite.email,
      expiresAt: invite.expiresAt.toISOString(),
      status: invite.status,
    })),
    viewerUserId: context.ownerUserId,
    personal,
    shared,
  };
}
