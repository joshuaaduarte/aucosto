// Who is acting, for attribution on shared (household) data.
//
// Household rows are owned by the household's data user, so the event log's
// userId says "household", not "Ana" or "Josh". Server actions that touch
// shared data wrap their work in runAsActor(viewerUserId, ...); recordEvent()
// then stamps meta.actorUserId. AsyncLocalStorage keeps service signatures
// unchanged (services run from crons and webhooks too, where no actor exists).

import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

const storage = new AsyncLocalStorage<{ actorUserId: string }>();

export function runAsActor<T>(actorUserId: string, fn: () => Promise<T>): Promise<T> {
  return storage.run({ actorUserId }, fn);
}

export function currentActorUserId(): string | null {
  return storage.getStore()?.actorUserId ?? null;
}
