"use client";

import { useActionState, useState, useTransition } from "react";
import {
  disableDemoMode,
  enableDemoMode,
  resetDemoMode,
  savePrivacySettings,
  type PrivacyState,
} from "./privacy-actions";

const initialState: PrivacyState = undefined;

export function PrivacyPanel({
  financeVisible,
  appLockEnabled,
  isDemoMode,
}: {
  financeVisible: boolean;
  appLockEnabled: boolean;
  isDemoMode: boolean;
}) {
  const [settingsState, settingsAction, settingsPending] = useActionState(
    savePrivacySettings,
    initialState,
  );
  const [demoPending, startDemoTransition] = useTransition();
  const [demoMessage, setDemoMessage] = useState<PrivacyState>(initialState);

  return (
    <section className="rounded-[1.9rem] border border-zinc-200/80 bg-white/92 p-5 shadow-[0_20px_60px_-45px_rgba(24,24,27,0.18)] sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
            Privacy + demos
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-zinc-950 sm:text-2xl">
            Keep finance private and switch into a safe demo workspace when you need it.
          </h2>
        </div>
        {isDemoMode ? (
          <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
            Demo mode on
          </span>
        ) : null}
      </div>

      <form action={settingsAction} className="mt-5 space-y-4">
        <label className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50/65 px-4 py-4">
          <input
            type="checkbox"
            name="financeVisible"
            defaultChecked={financeVisible}
            className="mt-1 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
          />
          <span>
            <span className="block text-sm font-medium text-zinc-900">
              Show finance in the app
            </span>
            <span className="mt-1 block text-sm text-zinc-500">
              Hides finance from the nav, hub, and direct route access until you turn it back on.
            </span>
          </span>
        </label>

        <div className="rounded-2xl border border-zinc-200 bg-zinc-50/65 px-4 py-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              name="appLockEnabled"
              defaultChecked={appLockEnabled}
              className="mt-1 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
            />
            <span>
              <span className="block text-sm font-medium text-zinc-900">
                Require a PIN to open the app
              </span>
              <span className="mt-1 block text-sm text-zinc-500">
                Good for leaving aucosto open without exposing the app to whoever walks by.
              </span>
            </span>
          </label>
          <div className="mt-4 w-full max-w-xs space-y-1.5">
            <label htmlFor="pin" className="block text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
              New PIN
            </label>
            <input
              id="pin"
              name="pin"
              type="password"
              inputMode="numeric"
              placeholder={appLockEnabled ? "Leave blank to keep current PIN" : "4 to 8 digits"}
              className="block min-h-11 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            {settingsState?.ok === true ? (
              <p className="text-emerald-600">{settingsState.message}</p>
            ) : settingsState?.ok === false ? (
              <p className="text-red-600">{settingsState.error}</p>
            ) : (
              <p className="text-zinc-500">Privacy settings apply immediately.</p>
            )}
          </div>
          <button
            type="submit"
            disabled={settingsPending}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-zinc-900 px-5 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-800 disabled:opacity-50 sm:w-auto"
          >
            {settingsPending ? "Saving…" : "Save privacy settings"}
          </button>
        </div>
      </form>

      <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50/65 px-4 py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-sm font-medium text-zinc-900">Demo workspace</h3>
            <p className="mt-1 text-sm text-zinc-500">
              Switch into seeded fake data so you can show time + finance without exposing the real thing.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {isDemoMode ? (
            <>
              <button
                type="button"
                disabled={demoPending}
                onClick={() =>
                  startDemoTransition(async () => {
                    setDemoMessage(await disableDemoMode());
                  })
                }
                className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 hover:border-zinc-300 hover:text-zinc-900 disabled:opacity-50 sm:w-auto"
              >
                Back to personal data
              </button>
              <button
                type="button"
                disabled={demoPending}
                onClick={() =>
                  startDemoTransition(async () => {
                    setDemoMessage(await resetDemoMode());
                  })
                }
                className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-zinc-900 px-4 text-sm font-medium text-zinc-50 hover:bg-zinc-800 disabled:opacity-50 sm:w-auto"
              >
                Reset demo data
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={demoPending}
              onClick={() =>
                startDemoTransition(async () => {
                  setDemoMessage(await enableDemoMode());
                })
              }
              className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-zinc-900 px-4 text-sm font-medium text-zinc-50 hover:bg-zinc-800 disabled:opacity-50 sm:w-auto"
            >
              Enter demo mode
            </button>
          )}
        </div>
        <div className="mt-3 text-sm">
          {demoMessage?.ok === true ? (
            <p className="text-emerald-600">{demoMessage.message}</p>
          ) : demoMessage?.ok === false ? (
            <p className="text-red-600">{demoMessage.error}</p>
          ) : (
            <p className="text-zinc-500">The demo workspace is isolated from your real time and finance data.</p>
          )}
        </div>
      </div>
    </section>
  );
}
