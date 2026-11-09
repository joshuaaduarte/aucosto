// Who is acting, for attribution on shared (household) data.
//
// Household rows are owned by the household's data user, so the event log's
// userId says "household", not "Ana" or "Josh". Server actions that touch
// shared data wrap their work in runAsActor(viewerUserId, ...); recordEvent()
// then stamps meta.actorUserId. AsyncLocalStorage keeps service signatures
// unchanged (services run from crons and webhooks too, where no actor exists).

//
// The same store also carries *how* the write arrived: an external agent
// calling the assistant API with a bearer key runs inside runAsAgent(), and
// recordEvent() stamps meta.via = "agent". The usage page reads that to tell
// what Josh did from what an agent did on his behalf.

import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

type ActorStore = { actorUserId?: string; via?: "agent" };

const storage = new AsyncLocalStorage<ActorStore>();

export function runAsActor<T>(actorUserId: string, fn: () => Promise<T>): Promise<T> {
  return storage.run({ ...storage.getStore(), actorUserId }, fn);
}

/** Run a request made by an external agent (bearer key), not a person. */
export function runAsAgent<T>(fn: () => Promise<T>): Promise<T> {
  return storage.run({ ...storage.getStore(), via: "agent" }, fn);
}

export function currentActorUserId(): string | null {
  return storage.getStore()?.actorUserId ?? null;
}

export function currentActorVia(): "agent" | null {
  return storage.getStore()?.via ?? null;
}
