"use client";

import { useActionState, useState, useTransition } from "react";
import {
  cancelHouseholdInvite,
  inviteToHousehold,
  moveFinance,
  removeFromHousehold,
  saveHouseholdName,
  setUpHousehold,
  type HouseholdState,
} from "./household-actions";

export type HouseholdPanelData = {
  ready: boolean;
  role: "owner" | "partner";
  isDemoMode: boolean;
  household: { name: string } | null;
  members: Array<{ userId: string; name: string | null; email: string; role: string; removed: boolean }>;
  invites: Array<{ id: string; email: string; expiresAt: string; status: string }>;
  viewerUserId: string;
  personal: MovableSummary | null;
  shared: MovableSummary | null;
};

type MovableSummary = {
  accounts: Array<{ id: string; name: string; institutionName: string | null; transactionCount: number }>;
  unlinkedTransactionCount: number;
  goalCount: number;
  budgetCount: number;
  billCount: number;
};

export function Notice({ state }: { state: HouseholdState }) {
  if (!state) return null;
  return (
    <p
      className="rounded-md px-3 py-2 text-[0.8125rem]"
      role="status"
      style={
        state.ok
          ? { background: "var(--bg-tint)", color: "var(--text-muted)" }
          : {
              background: "var(--accent-tint)",
              color: "var(--accent-strong)",
              border: "1px solid var(--accent-tint-strong)",
            }
      }
    >
      {state.ok ? state.message : state.error}
    </p>
  );
}

const muted = { color: "var(--text-muted)" } as const;
const faint = { color: "var(--text-faint)" } as const;

export function HouseholdPanel({ data }: { data: HouseholdPanelData }) {
  if (!data.ready) {
    return (
      <p className="text-[0.8125rem]" style={muted}>
        Household tables aren&apos;t in the database yet. Run{" "}
        <code className="font-mono text-[0.75rem]">scripts/create-household-home.sql</code> (see{" "}
        <code className="font-mono text-[0.75rem]">docs/household.md</code>), then reload.
      </p>
    );
  }
  if (data.isDemoMode) {
    return (
      <p className="text-[0.8125rem]" style={muted}>
        Turn off demo mode to manage the household.
      </p>
    );
  }
  if (!data.household) return <SetUp />;
  return (
    <div className="space-y-8">
      {data.role === "owner" ? <Rename name={data.household.name} /> : null}
      <Members data={data} />
      {data.role === "owner" ? <Invite invites={data.invites} /> : null}
      <ShareFinance data={data} />
    </div>
  );
}

function SetUp() {
  const [state, action, pending] = useActionState(setUpHousehold, undefined);
  return (
    <form action={action} className="space-y-3">
      <p className="text-[0.8125rem]" style={muted}>
        A household is a shared space for finance and the Home tool. Your other
        tools (time, habits, reflections, work, contacts) stay private to you.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input name="name" defaultValue="Our home" className="field max-w-[16rem]" aria-label="Household name" />
        <button type="submit" disabled={pending} className="btn-ink">
          {pending ? "Setting up…" : "Set up household"}
        </button>
      </div>
      <Notice state={state} />
    </form>
  );
}

function Rename({ name }: { name: string }) {
  const [state, action, pending] = useActionState(saveHouseholdName, undefined);
  return (
    <form action={action} className="space-y-2">
      <label className="block text-[0.75rem] font-medium" style={muted} htmlFor="household-name">
        Household name
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input id="household-name" name="name" defaultValue={name} className="field max-w-[16rem]" />
        <button type="submit" disabled={pending} className="btn-ghost">
          Save
        </button>
      </div>
      <Notice state={state} />
    </form>
  );
}

function Members({ data }: { data: HouseholdPanelData }) {
  const [state, setState] = useState<HouseholdState>(undefined);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <p className="text-[0.75rem] font-medium" style={muted}>
        People
      </p>
      <ul className="divide-y rounded-md border" style={{ borderColor: "var(--border-faint)" }}>
        {data.members.map((member) => (
          <li
            key={member.userId}
            className="flex items-center justify-between gap-3 px-3 py-2.5"
            style={{ borderColor: "var(--border-faint)" }}
          >
            <div className="min-w-0">
              <p className="truncate text-[0.875rem]" style={{ color: "var(--text)" }}>
                {member.name ?? member.email}
                {member.userId === data.viewerUserId ? " (you)" : ""}
              </p>
              <p className="truncate text-[0.75rem]" style={faint}>
                {member.email} · {member.role === "owner" ? "Owner, all tools" : "Finance and Home only"}
                {member.removed ? " · access removed" : ""}
              </p>
            </div>
            {data.role === "owner" && member.role === "partner" && !member.removed ? (
              <button
                type="button"
                className="btn-ghost shrink-0"
                disabled={pending}
                onClick={() => {
                  if (!confirm(`Remove ${member.name ?? member.email}'s access?`)) return;
                  start(async () => setState(await removeFromHousehold(member.userId)));
                }}
              >
                Remove access
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      <Notice state={state} />
    </div>
  );
}

function Invite({ invites }: { invites: HouseholdPanelData["invites"] }) {
  const [state, action, pending] = useActionState(inviteToHousehold, undefined);
  const [cancelState, setCancelState] = useState<HouseholdState>(undefined);
  const [cancelling, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const inviteUrl = state?.ok ? state.inviteUrl : undefined;
  const open = invites.filter((invite) => invite.status === "valid");

  return (
    <div className="space-y-3">
      <form action={action} className="space-y-2">
        <label className="block text-[0.75rem] font-medium" style={muted} htmlFor="invite-email">
          Invite someone
        </label>
        <p className="text-[0.75rem]" style={faint}>
          They get Finance and Home only, and sign in with Google or a password of their own.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id="invite-email"
            name="email"
            type="email"
            required
            placeholder="their@email.com"
            className="field max-w-[18rem]"
          />
          <button type="submit" disabled={pending} className="btn-ink">
            {pending ? "Creating…" : "Create invite link"}
          </button>
        </div>
      </form>
      <Notice state={state} />
      {inviteUrl ? (
        <div className="flex flex-wrap items-center gap-2">
          <input readOnly value={inviteUrl} className="field font-mono text-[0.75rem]" onFocus={(e) => e.currentTarget.select()} />
          <button
            type="button"
            className="btn-ghost"
            onClick={async () => {
              await navigator.clipboard.writeText(inviteUrl);
              setCopied(true);
            }}
          >
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      ) : null}
      {open.length ? (
        <ul className="space-y-1">
          {open.map((invite) => (
            <li key={invite.id} className="flex items-center justify-between gap-3 text-[0.8125rem]" style={muted}>
              <span>
                Pending: {invite.email} (expires{" "}
                {new Date(invite.expiresAt).toLocaleDateString([], { month: "short", day: "numeric" })})
              </span>
              <button
                type="button"
                className="btn-ghost"
                disabled={cancelling}
                onClick={() => start(async () => setCancelState(await cancelHouseholdInvite(invite.id)))}
              >
                Cancel
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <Notice state={cancelState} />
    </div>
  );
}

function ShareFinance({ data }: { data: HouseholdPanelData }) {
  const [state, setState] = useState<HouseholdState>(undefined);
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState<string[]>([]);
  const [unlinked, setUnlinked] = useState(false);
  const [planning, setPlanning] = useState(false);
  const personal = data.personal;
  const shared = data.shared;

  const toggle = (id: string) =>
    setPicked((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));

  const hasPersonal =
    personal &&
    (personal.accounts.length > 0 ||
      personal.unlinkedTransactionCount > 0 ||
      personal.goalCount + personal.budgetCount + personal.billCount > 0);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-[0.75rem] font-medium" style={muted}>
          Share finance with the household
        </p>
        <p className="text-[0.75rem]" style={faint}>
          Finance has two spaces: the household (everyone sees it) and Just me (only you).
          Switch between them at the top of the Finance page. Linked bank accounts move
          together with the rest of that bank&apos;s accounts.
        </p>
      </div>

      {hasPersonal ? (
        <div className="space-y-2">
          <p className="text-[0.75rem]" style={muted}>In Just me</p>
          <ul className="space-y-1.5">
            {personal!.accounts.map((account) => (
              <li key={account.id}>
                <label className="flex items-center gap-2 text-[0.8125rem]" style={{ color: "var(--text)" }}>
                  <input type="checkbox" checked={picked.includes(account.id)} onChange={() => toggle(account.id)} />
                  {account.name}
                  <span style={faint}>
                    {account.institutionName ? `${account.institutionName} · ` : ""}
                    {account.transactionCount} transactions
                  </span>
                </label>
              </li>
            ))}
            {personal!.unlinkedTransactionCount > 0 ? (
              <li>
                <label className="flex items-center gap-2 text-[0.8125rem]" style={{ color: "var(--text)" }}>
                  <input type="checkbox" checked={unlinked} onChange={() => setUnlinked((v) => !v)} />
                  Imported transactions not tied to an account
                  <span style={faint}>{personal!.unlinkedTransactionCount}</span>
                </label>
              </li>
            ) : null}
            {personal!.goalCount + personal!.budgetCount + personal!.billCount > 0 ? (
              <li>
                <label className="flex items-center gap-2 text-[0.8125rem]" style={{ color: "var(--text)" }}>
                  <input type="checkbox" checked={planning} onChange={() => setPlanning((v) => !v)} />
                  Goals, budgets and bills
                  <span style={faint}>
                    {personal!.goalCount + personal!.budgetCount + personal!.billCount}
                  </span>
                </label>
              </li>
            ) : null}
          </ul>
          <button
            type="button"
            className="btn-ink"
            disabled={pending || (picked.length === 0 && !unlinked && !planning)}
            onClick={() =>
              start(async () => {
                setState(
                  await moveFinance({
                    direction: "to_household",
                    accountIds: picked,
                    includeUnlinkedTransactions: unlinked,
                    includePlanning: planning,
                  }),
                );
                setPicked([]);
                setUnlinked(false);
                setPlanning(false);
              })
            }
          >
            {pending ? "Moving…" : "Move to household"}
          </button>
        </div>
      ) : (
        <p className="text-[0.8125rem]" style={muted}>
          Nothing left in Just me to share.
        </p>
      )}

      {data.role === "owner" && shared && shared.accounts.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[0.75rem]" style={muted}>In the household</p>
          <ul className="space-y-1">
            {shared.accounts.map((account) => (
              <li key={account.id} className="flex items-center justify-between gap-3 text-[0.8125rem]">
                <span style={{ color: "var(--text)" }}>
                  {account.name}{" "}
                  <span style={faint}>{account.institutionName ?? ""}</span>
                </span>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={pending}
                  onClick={() =>
                    start(async () =>
                      setState(
                        await moveFinance({
                          direction: "to_personal",
                          accountIds: [account.id],
                          includeUnlinkedTransactions: false,
                          includePlanning: false,
                        }),
                      ),
                    )
                  }
                >
                  Move to Just me
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <Notice state={state} />
    </div>
  );
}
