"use client";

// Set up logging from an iPhone: a personal key plus the steps to build the
// Shortcut. Each person makes their own key, so entries show who logged them.

import { useState, useTransition } from "react";
import { createFinanceShortcutKey } from "../actions";

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1">
      <p className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
        {label}
      </p>
      <div className="flex gap-2">
        <input readOnly value={value} className="field min-w-0 flex-1 font-mono text-[0.75rem]" onFocus={(e) => e.currentTarget.select()} />
        <button
          type="button"
          className="btn-ghost"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            } catch {
              /* select-and-copy still works */
            }
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export function ShortcutPanel({ endpoint, hasKey }: { endpoint: string; hasKey: boolean }) {
  const [key, setKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4 text-[0.875rem]" style={{ color: "var(--text-muted)" }}>
      <p>
        Log a purchase without opening the app: from the Action button, the Lock Screen, or by saying
        &ldquo;Hey Siri, log spending&rdquo;. It takes about five minutes to set up once.
      </p>
      {key ? (
        <div className="space-y-3">
          <CopyField label="Address" value={endpoint} />
          <CopyField label="Your personal key (shown once; keep it private)" value={key} />
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn-ink"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const result = await createFinanceShortcutKey();
                if (result?.ok) setKey(result.key);
                else setError(result?.error ?? "Could not make a key.");
              })
            }
          >
            {pending ? "Making…" : hasKey ? "Make a new key" : "Make my key"}
          </button>
          {hasKey ? (
            <span className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>
              A new key turns your old one off.
            </span>
          ) : null}
        </div>
      )}
      {error ? (
        <p className="text-[0.75rem]" style={{ color: "var(--accent-strong)" }} role="alert">
          {error}
        </p>
      ) : null}
      <ol className="list-decimal space-y-1.5 pl-5">
        <li>Open the Shortcuts app and tap + to make a new shortcut. Name it &ldquo;Log spending&rdquo;.</li>
        <li>Add <b>Ask for Input</b>: type Number, prompt &ldquo;How much?&rdquo;.</li>
        <li>Add another <b>Ask for Input</b>: type Text, prompt &ldquo;Where?&rdquo;.</li>
        <li>
          Add <b>Get Contents of URL</b> with the address above. Tap Show More: Method POST; add a header
          named <code>Authorization</code> with the value <code>Bearer </code> followed by your key; Request
          Body JSON with <code>amount</code> = the first answer and <code>description</code> = the second.
          Optional: <code>category</code> (like Groceries) and <code>account</code> (an account name).
        </li>
        <li>
          Add <b>Get Dictionary Value</b> for <code>message</code>, then <b>Show Notification</b> with it, so
          you see &ldquo;Logged $12.50 at Trader Joe&rsquo;s&rdquo;.
        </li>
        <li>
          Put it where your thumb is: Settings → Action Button → Shortcut, or add it to the Lock Screen or
          Control Center.
        </li>
      </ol>
    </div>
  );
}
