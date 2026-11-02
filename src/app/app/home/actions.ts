"use server";

import { revalidatePath } from "next/cache";
import { withHomeUser } from "@/lib/server-action";
import { listHouseholdMembers } from "@/lib/household";
import { requireViewerContext } from "@/lib/viewer-context";
import * as home from "@/lib/services/home";

export type HomeState = { ok: true; message?: string } | { ok: false; error: string } | undefined;

function revalidateHome() {
  revalidatePath("/app");
  revalidatePath("/app/home");
}

function parseDateOnly(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(Number.NaN);
  return new Date(`${value}T09:00:00`);
}

/** Assignees must be household members; anything else is dropped. */
async function memberIds(): Promise<string[]> {
  const context = await requireViewerContext();
  if (!context.householdId) return [context.ownerUserId];
  const members = await listHouseholdMembers(context.householdId);
  return members.filter((m) => !m.removed).map((m) => m.userId);
}

export async function createList(_prev: HomeState, formData: FormData): Promise<HomeState> {
  return withHomeUser<HomeState>(async ({ userId }) => {
    // Preset chips submit their own name value after the (possibly empty) input.
    const name = formData.getAll("name").map(String).filter((v) => v.trim()).pop() ?? "";
    await home.createHomeList(userId, { name });
    revalidateHome();
    return { ok: true };
  }, "Could not create the list.");
}

export async function deleteList(listId: string): Promise<HomeState> {
  return withHomeUser<HomeState>(async ({ userId }) => {
    await home.deleteHomeList(userId, listId);
    revalidateHome();
    return { ok: true };
  }, "Could not delete the list.");
}

export async function addItems(listId: string, raw: string): Promise<HomeState> {
  return withHomeUser<HomeState>(async ({ userId, actorUserId }) => {
    await home.addHomeListItems(userId, actorUserId, listId, raw);
    revalidateHome();
    return { ok: true };
  }, "Could not add that.");
}

export async function toggleItem(itemId: string, checked: boolean): Promise<HomeState> {
  return withHomeUser<HomeState>(async ({ userId, actorUserId }) => {
    await home.setHomeListItemChecked(userId, actorUserId, itemId, checked);
    revalidateHome();
    return { ok: true };
  }, "Could not update the item.");
}

export async function removeItem(itemId: string): Promise<HomeState> {
  return withHomeUser<HomeState>(async ({ userId }) => {
    await home.deleteHomeListItem(userId, itemId);
    revalidateHome();
    return { ok: true };
  }, "Could not remove the item.");
}

export async function clearChecked(listId: string): Promise<HomeState> {
  return withHomeUser<HomeState>(async ({ userId }) => {
    await home.clearCheckedHomeListItems(userId, listId);
    revalidateHome();
    return { ok: true };
  }, "Could not clear the list.");
}

export async function saveTask(_prev: HomeState, formData: FormData): Promise<HomeState> {
  return withHomeUser<HomeState>(async ({ userId }) => {
    const members = await memberIds();
    const assignee = String(formData.get("assigneeUserId") ?? "");
    await home.saveHomeTask(userId, {
      id: String(formData.get("id") ?? "") || undefined,
      kind: String(formData.get("kind") ?? "chore"),
      title: String(formData.get("title") ?? ""),
      notes: String(formData.get("notes") ?? ""),
      cadenceDays: Number(formData.get("cadenceDays") ?? 7),
      assigneeUserId: members.includes(assignee) ? assignee : null,
      rotate: formData.get("rotate") === "on",
      nextDueAt: parseDateOnly(String(formData.get("nextDueAt") ?? "")),
    });
    revalidateHome();
    return { ok: true, message: "Saved." };
  }, "Could not save the task.");
}

export async function completeTask(taskId: string): Promise<HomeState> {
  return withHomeUser<HomeState>(async ({ userId, actorUserId }) => {
    await home.completeHomeTask(userId, actorUserId, taskId, await memberIds());
    revalidateHome();
    return { ok: true };
  }, "Could not mark it done.");
}

export async function archiveTask(taskId: string): Promise<HomeState> {
  return withHomeUser<HomeState>(async ({ userId }) => {
    await home.archiveHomeTask(userId, taskId);
    revalidateHome();
    return { ok: true };
  }, "Could not remove the task.");
}
