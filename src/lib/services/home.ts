// Home tool service: shared lists, chores and maintenance.
//
// userId is the Home scope (the household's data user once a household
// exists, else the person's own id). actorUserId is the person acting, kept
// on rows for "who added / who did it". Reads degrade to empty while the
// tables don't exist yet (scripts/create-household-home.sql).

import "server-only";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/auth/can";
import { recordEvent } from "@/lib/services/events";
import { isMissingHouseholdTable } from "@/lib/household";
import { isHomeTaskKind, nextAssignee, nextDueAfterDone, parseListItemsInput } from "@/lib/home";
import type { HomeList, HomeListItem, HomeTask } from "@/generated/prisma/client";

export type HomeListWithItems = HomeList & { items: HomeListItem[] };

function degrade<T>(label: string, fallback: T) {
  return (error: unknown): T => {
    if (!isMissingHouseholdTable(error)) console.error(`[home] ${label} failed`, error);
    return fallback;
  };
}

/** False while the home tables are missing, so pages can show setup copy. */
export async function isHomeReady(userId: string): Promise<boolean> {
  requireCan(userId, "home", "read");
  try {
    await prisma.homeList.findFirst({ where: { userId }, select: { id: true } });
    return true;
  } catch (error) {
    if (isMissingHouseholdTable(error)) return false;
    throw error;
  }
}

// ── Lists ────────────────────────────────────────────────────────────────

export async function listHomeLists(
  userId: string,
  options: { checkedSince?: Date } = {},
): Promise<HomeListWithItems[]> {
  requireCan(userId, "home", "read");
  // Checked items stay visible for a day so a mis-tap can be undone.
  const since = options.checkedSince ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
  return prisma.homeList
    .findMany({
      where: { userId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        items: {
          where: { OR: [{ checkedAt: null }, { checkedAt: { gte: since } }] },
          orderBy: [{ checkedAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
        },
      },
    })
    .catch(degrade("list read", []));
}

export async function createHomeList(
  userId: string,
  input: { name: string; emoji?: string | null },
): Promise<HomeList> {
  requireCan(userId, "home", "write");
  const name = input.name.trim().slice(0, 40);
  if (!name) throw new Error("Name the list.");
  const existing = await prisma.homeList.findUnique({
    where: { userId_name: { userId, name } },
  });
  if (existing) return existing;
  const count = await prisma.homeList.count({ where: { userId } });
  const list = await prisma.homeList.create({
    data: { userId, name, emoji: input.emoji?.trim() || null, sortOrder: count },
  });
  await recordEvent({ userId, tool: "home", type: "home.list_created", refId: list.id, meta: { name } });
  return list;
}

export async function deleteHomeList(userId: string, listId: string): Promise<void> {
  requireCan(userId, "home", "write");
  const { count } = await prisma.homeList.deleteMany({ where: { id: listId, userId } });
  if (count > 0) {
    await recordEvent({ userId, tool: "home", type: "home.list_deleted", refId: listId });
  }
}

/**
 * Add one or many items ("milk, eggs"). An item already on the list but
 * checked off comes back unchecked instead of duplicating.
 */
export async function addHomeListItems(
  userId: string,
  actorUserId: string,
  listId: string,
  raw: string,
): Promise<number> {
  requireCan(userId, "home", "write");
  const list = await prisma.homeList.findFirst({ where: { id: listId, userId }, select: { id: true } });
  if (!list) throw new Error("List not found.");
  const titles = parseListItemsInput(raw);
  if (titles.length === 0) return 0;

  const existing = await prisma.homeListItem.findMany({
    where: { listId, title: { in: titles, mode: "insensitive" } },
    select: { id: true, title: true, checkedAt: true },
  });
  const byTitle = new Map(existing.map((item) => [item.title.toLowerCase(), item]));
  const reopen = existing.filter((item) => item.checkedAt).map((item) => item.id);
  const fresh = titles.filter((title) => !byTitle.has(title.toLowerCase()));

  await prisma.$transaction([
    prisma.homeListItem.updateMany({
      where: { id: { in: reopen } },
      data: { checkedAt: null, checkedByUserId: null, addedByUserId: actorUserId },
    }),
    prisma.homeListItem.createMany({
      data: fresh.map((title) => ({ userId, listId, title, addedByUserId: actorUserId })),
    }),
  ]);
  const added = reopen.length + fresh.length;
  if (added > 0) {
    await recordEvent({
      userId,
      tool: "home",
      type: "home.items_added",
      refId: listId,
      meta: { count: added },
    });
  }
  return added;
}

export async function setHomeListItemChecked(
  userId: string,
  actorUserId: string,
  itemId: string,
  checked: boolean,
): Promise<void> {
  requireCan(userId, "home", "write");
  await prisma.homeListItem.updateMany({
    where: { id: itemId, userId },
    data: checked
      ? { checkedAt: new Date(), checkedByUserId: actorUserId }
      : { checkedAt: null, checkedByUserId: null },
  });
}

export async function deleteHomeListItem(userId: string, itemId: string): Promise<void> {
  requireCan(userId, "home", "write");
  await prisma.homeListItem.deleteMany({ where: { id: itemId, userId } });
}

/** Clear checked items off a list (after a shopping trip). */
export async function clearCheckedHomeListItems(userId: string, listId: string): Promise<number> {
  requireCan(userId, "home", "write");
  const { count } = await prisma.homeListItem.deleteMany({
    where: { listId, userId, checkedAt: { not: null } },
  });
  return count;
}

// ── Chores + maintenance ─────────────────────────────────────────────────

export async function listHomeTasks(userId: string): Promise<HomeTask[]> {
  requireCan(userId, "home", "read");
  return prisma.homeTask
    .findMany({ where: { userId, archivedAt: null }, orderBy: { nextDueAt: "asc" } })
    .catch(degrade("task read", []));
}

export type SaveHomeTaskInput = {
  id?: string;
  kind: string;
  title: string;
  notes?: string | null;
  cadenceDays: number;
  assigneeUserId?: string | null;
  rotate?: boolean;
  nextDueAt: Date;
};

export async function saveHomeTask(userId: string, input: SaveHomeTaskInput): Promise<void> {
  requireCan(userId, "home", "write");
  const title = input.title.trim().slice(0, 80);
  if (!title) throw new Error("Name the task.");
  if (!isHomeTaskKind(input.kind)) throw new Error("Pick chore or maintenance.");
  const cadenceDays = Math.round(input.cadenceDays);
  if (!Number.isFinite(cadenceDays) || cadenceDays < 1 || cadenceDays > 3650) {
    throw new Error("Repeat every 1 to 3650 days.");
  }
  if (Number.isNaN(input.nextDueAt.getTime())) throw new Error("Pick when it's next due.");
  const data = {
    kind: input.kind,
    title,
    notes: input.notes?.trim() || null,
    cadenceDays,
    assigneeUserId: input.assigneeUserId || null,
    rotate: Boolean(input.rotate),
    nextDueAt: input.nextDueAt,
  };
  if (input.id) {
    const { count } = await prisma.homeTask.updateMany({ where: { id: input.id, userId }, data });
    if (count === 0) throw new Error("Task not found.");
    await recordEvent({ userId, tool: "home", type: "home.task_updated", refId: input.id });
    return;
  }
  const task = await prisma.homeTask.create({ data: { userId, ...data } });
  await recordEvent({
    userId,
    tool: "home",
    type: "home.task_created",
    refId: task.id,
    meta: { title, kind: input.kind },
  });
}

export async function completeHomeTask(
  userId: string,
  actorUserId: string,
  taskId: string,
  memberUserIds: string[],
  now = new Date(),
): Promise<void> {
  requireCan(userId, "home", "write");
  const task = await prisma.homeTask.findFirst({ where: { id: taskId, userId } });
  if (!task) throw new Error("Task not found.");
  await prisma.homeTask.update({
    where: { id: taskId },
    data: {
      lastDoneAt: now,
      lastDoneByUserId: actorUserId,
      nextDueAt: nextDueAfterDone(now, task.cadenceDays),
      assigneeUserId: nextAssignee({
        rotate: task.rotate,
        assigneeUserId: task.assigneeUserId,
        doneByUserId: actorUserId,
        memberUserIds,
      }),
    },
  });
  await recordEvent({
    userId,
    tool: "home",
    type: "home.task_done",
    refId: taskId,
    meta: { title: task.title, kind: task.kind },
  });
}

export async function archiveHomeTask(userId: string, taskId: string): Promise<void> {
  requireCan(userId, "home", "write");
  const { count } = await prisma.homeTask.updateMany({
    where: { id: taskId, userId },
    data: { archivedAt: new Date() },
  });
  if (count > 0) {
    await recordEvent({ userId, tool: "home", type: "home.task_archived", refId: taskId });
  }
}
