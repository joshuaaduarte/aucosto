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
    <section className="rule-t rule-b border-ink py-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.28em] text-ink-fade">
            ❦ The Editorial Office ❦
          </p>
          <h2 className="mt-2 font-display text-3xl font-medium italic tracking-[-0.02em] text-ink">
            Privacy, locks, and the demonstration edition.
          </h2>
        </div>
        {isDemoMode ? (
          <span className="font-mono text-[0.6875rem] uppercase tracking-[0.22em] text-oxblood">
            ❦ Demonstration mode is on ❦
          </span>
        ) : null}
      </header>

      <form action={settingsAction} className="mt-8 space-y-7">
        <div className="rule-t border-ink/30 pt-5">
          <label className="flex items-baseline gap-4">
            <input
              type="checkbox"
              name="financeVisible"
              defaultChecked={financeVisible}
              className="mt-1 accent-oxblood"
            />
            <span>
              <span className="block font-display text-lg italic text-ink">
                Print the Ledger in the daily edition
              </span>
              <span className="mt-1 block font-serif text-sm italic leading-relaxed text-ink-fade">
                With this off, finance is removed from the navigation, the
                hub, and any direct route, until you reinstate it.
              </span>
            </span>
          </label>
        </div>

        <div className="rule-t border-ink/30 pt-5">
          <label className="flex items-baseline gap-4">
            <input
              type="checkbox"
              name="appLockEnabled"
              defaultChecked={appLockEnabled}
              className="mt-1 accent-oxblood"
            />
            <span>
              <span className="block font-display text-lg italic text-ink">
                Require a cipher to release the edition
              </span>
              <span className="mt-1 block font-serif text-sm italic leading-relaxed text-ink-fade">
                Useful if aucosto is left open in a public place — the press
                will be locked until the cipher is presented.
              </span>
            </span>
          </label>
          <div className="ml-7 mt-4 max-w-xs">
            <label
              htmlFor="pin"
              className="block font-mono text-[0.625rem] uppercase tracking-[0.22em] text-ink-fade"
            >
              New cipher
            </label>
            <input
              id="pin"
              name="pin"
              type="password"
              inputMode="numeric"
              placeholder={
                appLockEnabled
                  ? "leave blank to keep current"
                  : "4 to 8 digits"
              }
              className="field font-mono text-lg tracking-[0.3em] tabular"
            />
          </div>
        </div>

        <div className="rule-t border-ink/30 pt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-serif text-sm italic text-ink-fade">
            {settingsState?.ok === true ? (
              <span className="text-verdigris">{settingsState.message}</span>
            ) : settingsState?.ok === false ? (
              <span className="text-oxblood">{settingsState.error}</span>
            ) : (
              "Changes take effect upon saving."
            )}
          </p>
          <button
            type="submit"
            disabled={settingsPending}
            className="btn-ink w-full sm:w-auto"
          >
            {settingsPending ? "Setting…" : "Set privacy preferences  ✎"}
          </button>
        </div>
      </form>

      <div className="rule-t border-ink/30 mt-10 pt-5">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <p className="font-mono text-[0.6875rem] uppercase tracking-[0.22em] text-ink-fade">
              The Demonstration Edition
            </p>
            <h3 className="mt-1 font-display text-xl italic text-ink">
              A safe workspace, set in fixtures.
            </h3>
            <p className="mt-1 max-w-2xl font-serif text-sm italic leading-relaxed text-ink-fade">
              Switch into seeded fixtures so the columns can be shown without
              exposing your true figures.
            </p>
          </div>
        </header>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
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
                className="btn-ghost w-full sm:w-auto"
              >
                Return to true figures
              </button>
              <button
                type="button"
                disabled={demoPending}
                onClick={() =>
                  startDemoTransition(async () => {
                    setDemoMessage(await resetDemoMode());
                  })
                }
                className="btn-ink w-full sm:w-auto"
              >
                Reset the fixtures  ↺
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
              className="btn-ink w-full sm:w-auto"
            >
              Enter the demonstration edition  →
            </button>
          )}
        </div>
        <p className="mt-4 font-serif text-sm italic text-ink-fade">
          {demoMessage?.ok === true ? (
            <span className="text-verdigris">{demoMessage.message}</span>
          ) : demoMessage?.ok === false ? (
            <span className="text-oxblood">{demoMessage.error}</span>
          ) : (
            "The demonstration workspace is isolated from your true time and finance data."
          )}
        </p>
      </div>
    </section>
  );
}
