import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatDuration } from "@/lib/time";
import { StartForm } from "./start-form";
import { RunningCard } from "./running-card";
import { EntryDeleteButton } from "./entry-row";

export const dynamic = "force-dynamic";

export default async function TimePage() {
  const session = await auth();
  const userId = session!.user.id;

  const [running, recent] = await Promise.all([
    prisma.timeEntry.findFirst({
      where: { userId, endedAt: null },
      orderBy: { startedAt: "desc" },
    }),
    prisma.timeEntry.findMany({
      where: { userId, endedAt: { not: null } },
      orderBy: { startedAt: "desc" },
      take: 30,
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Time tracker</h1>
        <p className="mt-2 text-zinc-500">
          One timer at a time. Starting a new one stops the previous.
        </p>
      </div>

      {running ? (
        <RunningCard
          label={running.label}
          category={running.category}
          startedAtIso={running.startedAt.toISOString()}
        />
      ) : (
        <StartForm />
      )}

      <div>
        <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
          Recent entries
        </h2>
        {recent.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Nothing yet. Start a timer above.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {recent.map((entry) => {
              const duration =
                (entry.endedAt!.getTime() - entry.startedAt.getTime()) | 0;
              return (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {entry.label}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {entry.startedAt.toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                      {entry.category ? ` · ${entry.category}` : ""}
                    </p>
                  </div>
                  <span className="font-mono text-sm tabular-nums text-zinc-700 dark:text-zinc-300">
                    {formatDuration(duration)}
                  </span>
                  <EntryDeleteButton id={entry.id} />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
