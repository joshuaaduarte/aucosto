// Read-only calendar feeds (private iCal links from Google Calendar /
// Outlook) mirrored into CalendarItem. Part of the calendar tool: rows carry
// sourceTool = "feed", sourceRefId = feed id, externalId = "feed:<id>:<key>".
//
// Sync model: lazy. Pages call `syncStaleCalendarFeeds` (at most every
// FEED_STALE_MS per feed) and the cron refreshes everyone. Each sync replaces
// the feed's rows inside its window, so a deleted or moved meeting follows
// the source. Reads degrade to empty while the table isn't created yet
// (scripts/create-calendar-feeds.sql).

import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/auth/can";
import { recordEvent } from "@/lib/services/events";
import { decryptSecret, encryptSecret } from "@/lib/secrets";
import {
  feedHostLabel,
  normalizeFeedUrl,
  parseFeedOccurrences,
  type FeedOccurrence,
} from "@/lib/ical-feed";

export const FEED_SOURCE_TOOL = "feed";
/** A feed older than this is refreshed on the next page view. */
export const FEED_STALE_MS = 15 * 60 * 1000;
const SYNC_PAST_DAYS = 14;
const SYNC_FUTURE_DAYS = 90;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_FEED_BYTES = 5 * 1024 * 1024;
const MAX_FEEDS = 8;

export type CalendarFeedSummary = {
  id: string;
  name: string;
  host: string;
  color: string | null;
  lastSyncedAt: Date | null;
  lastError: string | null;
  eventCount: number;
};

export class CalendarFeedsUnavailableError extends Error {
  constructor() {
    super("Calendar feeds aren't set up on this database yet.");
  }
}

function isMissingTable(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2021") return true;
    if (error.code === "P2010") return JSON.stringify(error.meta ?? {}).includes("42P01");
  }
  return false;
}

function toSummary(row: {
  id: string;
  name: string;
  urlHost: string;
  color: string | null;
  lastSyncedAt: Date | null;
  lastError: string | null;
  eventCount: number;
}): CalendarFeedSummary {
  return {
    id: row.id,
    name: row.name,
    host: row.urlHost,
    color: row.color,
    lastSyncedAt: row.lastSyncedAt,
    lastError: row.lastError,
    eventCount: row.eventCount,
  };
}

/** null = the table doesn't exist yet (show setup guidance, not an error). */
export async function listCalendarFeeds(userId: string): Promise<CalendarFeedSummary[] | null> {
  requireCan(userId, "calendar", "read");
  try {
    const rows = await prisma.calendarFeed.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toSummary);
  } catch (error) {
    if (isMissingTable(error)) return null;
    console.error("[calendar-feeds] list failed", error);
    return [];
  }
}

/** Map feedId → name, for labelling mirrored events. Never throws. */
export async function calendarFeedNames(userId: string): Promise<Map<string, string>> {
  const feeds = (await listCalendarFeeds(userId)) ?? [];
  return new Map(feeds.map((feed) => [feed.id, feed.name]));
}

function assertPublicHost(url: string) {
  const host = new URL(url).hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === "[::1]"
  ) {
    throw new Error("That link points at a private address.");
  }
}

async function fetchFeedText(url: string): Promise<string> {
  assertPublicHost(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "text/calendar, text/plain;q=0.8, */*;q=0.5", "User-Agent": "aucosto-calendar/1.0" },
      redirect: "follow",
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(
        response.status === 401 || response.status === 403 || response.status === 404
          ? `The calendar refused the link (HTTP ${response.status}). It may have been reset; copy a fresh one.`
          : `The calendar didn't answer (HTTP ${response.status}).`,
      );
    }
    const text = await response.text();
    if (text.length > MAX_FEED_BYTES) {
      throw new Error("That calendar is too large to import (over 5 MB).");
    }
    return text;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("The calendar took too long to answer.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function syncWindow(now: Date) {
  const from = new Date(now);
  from.setDate(from.getDate() - SYNC_PAST_DAYS);
  from.setHours(0, 0, 0, 0);
  const to = new Date(now);
  to.setDate(to.getDate() + SYNC_FUTURE_DAYS);
  return { from, to };
}

function externalIdFor(feedId: string, occurrence: FeedOccurrence) {
  // Keys can be long (UIDs from Outlook are ~100 chars); the unique index
  // copes, and keeping them readable makes debugging a feed possible.
  return `feed:${feedId}:${occurrence.key}`;
}

/**
 * Replace the feed's mirrored rows inside the sync window with what the feed
 * says now. Rows outside the window (older history) are left alone.
 */
async function writeOccurrences(
  userId: string,
  feedId: string,
  occurrences: FeedOccurrence[],
  window: { from: Date; to: Date },
) {
  const existing = await prisma.calendarItem.findMany({
    where: { userId, sourceTool: FEED_SOURCE_TOOL, sourceRefId: feedId },
    select: {
      id: true,
      externalId: true,
      title: true,
      startsAt: true,
      endsAt: true,
      allDay: true,
      location: true,
      notes: true,
      status: true,
    },
  });
  const byExternal = new Map(existing.map((row) => [row.externalId, row]));
  const seen = new Set<string>();
  const creates: Prisma.CalendarItemCreateManyInput[] = [];
  const updates: Array<Promise<unknown>> = [];

  for (const occurrence of occurrences) {
    const externalId = externalIdFor(feedId, occurrence);
    if (seen.has(externalId)) continue;
    seen.add(externalId);
    const data = {
      title: occurrence.title,
      startsAt: occurrence.startsAt,
      endsAt: occurrence.endsAt,
      allDay: occurrence.allDay,
      location: occurrence.location,
      notes: occurrence.notes,
      status: occurrence.status,
    };
    const row = byExternal.get(externalId);
    if (!row) {
      creates.push({
        userId,
        kind: "external",
        sourceTool: FEED_SOURCE_TOOL,
        sourceRefId: feedId,
        externalId,
        ...data,
      });
      continue;
    }
    const changed =
      row.title !== data.title ||
      row.startsAt.getTime() !== data.startsAt.getTime() ||
      row.endsAt.getTime() !== data.endsAt.getTime() ||
      row.allDay !== data.allDay ||
      row.location !== data.location ||
      row.notes !== data.notes ||
      row.status !== data.status;
    if (changed) {
      updates.push(prisma.calendarItem.update({ where: { id: row.id }, data }));
    }
  }

  const staleIds = existing
    .filter(
      (row) =>
        row.externalId &&
        !seen.has(row.externalId) &&
        row.endsAt > window.from &&
        row.startsAt < window.to,
    )
    .map((row) => row.id);

  if (creates.length > 0) {
    await prisma.calendarItem.createMany({ data: creates, skipDuplicates: true });
  }
  // Updates are few after the first sync; run them in small batches.
  for (let i = 0; i < updates.length; i += 20) {
    await Promise.all(updates.slice(i, i + 20));
  }
  if (staleIds.length > 0) {
    await prisma.calendarItem.deleteMany({ where: { userId, id: { in: staleIds } } });
  }
  return { created: creates.length, updated: updates.length, removed: staleIds.length };
}

export type FeedSyncResult =
  | { ok: true; eventCount: number; created: number; updated: number; removed: number }
  | { ok: false; error: string };

export async function syncCalendarFeed(
  userId: string,
  feedId: string,
  now: Date = new Date(),
): Promise<FeedSyncResult> {
  requireCan(userId, "calendar", "write");
  const feed = await prisma.calendarFeed.findFirst({ where: { id: feedId, userId } });
  if (!feed) return { ok: false, error: "Feed not found." };
  const window = syncWindow(now);
  try {
    const url = decryptSecret(feed.urlEncrypted);
    const text = await fetchFeedText(url);
    const occurrences = parseFeedOccurrences(text, window);
    const counts = await writeOccurrences(userId, feed.id, occurrences, window);
    await prisma.calendarFeed.update({
      where: { id: feed.id },
      data: { lastSyncedAt: now, lastError: null, eventCount: occurrences.length },
    });
    return { ok: true, eventCount: occurrences.length, ...counts };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed.";
    // Record the failure but keep lastSyncedAt moving, so a broken link
    // doesn't get re-fetched on every page view.
    await prisma.calendarFeed
      .update({ where: { id: feed.id }, data: { lastError: message.slice(0, 300), lastSyncedAt: now } })
      .catch(() => undefined);
    return { ok: false, error: message };
  }
}

/**
 * Refresh this user's feeds that are older than FEED_STALE_MS. Never throws —
 * it runs on page views. Returns how many feeds were refreshed.
 */
export async function syncStaleCalendarFeeds(
  userId: string,
  now: Date = new Date(),
  maxAgeMs: number = FEED_STALE_MS,
): Promise<number> {
  try {
    requireCan(userId, "calendar", "write");
    const cutoff = new Date(now.getTime() - maxAgeMs);
    const stale = await prisma.calendarFeed.findMany({
      where: { userId, OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: cutoff } }] },
      select: { id: true },
    });
    for (const feed of stale) {
      await syncCalendarFeed(userId, feed.id, now);
    }
    return stale.length;
  } catch (error) {
    if (!isMissingTable(error)) console.error("[calendar-feeds] stale sync failed", error);
    return 0;
  }
}

/** Every user's stale feeds — for the cron. Never throws. */
export async function syncAllStaleCalendarFeeds(now: Date = new Date()): Promise<number> {
  try {
    const owners = await prisma.calendarFeed.findMany({
      distinct: ["userId"],
      select: { userId: true },
    });
    let count = 0;
    for (const owner of owners) {
      count += await syncStaleCalendarFeeds(owner.userId, now, 60 * 60 * 1000);
    }
    return count;
  } catch (error) {
    if (!isMissingTable(error)) console.error("[calendar-feeds] cron sync failed", error);
    return 0;
  }
}

export async function addCalendarFeed(
  userId: string,
  input: { name: string; url: string; color?: string | null },
): Promise<{ feed: CalendarFeedSummary; sync: FeedSyncResult }> {
  requireCan(userId, "calendar", "write");
  const url = normalizeFeedUrl(input.url);
  if (!url) throw new Error("Paste the full https:// (or webcal://) link.");
  assertPublicHost(url);
  const name = input.name.trim() || feedHostLabel(url);

  let created;
  try {
    const count = await prisma.calendarFeed.count({ where: { userId } });
    if (count >= MAX_FEEDS) throw new Error(`You can add up to ${MAX_FEEDS} feeds.`);
    created = await prisma.calendarFeed.create({
      data: {
        userId,
        name: name.slice(0, 60),
        urlEncrypted: encryptSecret(url),
        urlHost: feedHostLabel(url),
        color: input.color?.trim() || null,
      },
    });
  } catch (error) {
    if (isMissingTable(error)) throw new CalendarFeedsUnavailableError();
    throw error;
  }

  await recordEvent({
    userId,
    tool: "calendar",
    type: "calendar.feed_added",
    refId: created.id,
    meta: { name: created.name, host: created.urlHost },
  });

  const sync = await syncCalendarFeed(userId, created.id);
  const fresh = await prisma.calendarFeed.findUniqueOrThrow({ where: { id: created.id } });
  return { feed: toSummary(fresh), sync };
}

/** Removes the feed and every event it mirrored. */
export async function removeCalendarFeed(userId: string, feedId: string): Promise<void> {
  requireCan(userId, "calendar", "write");
  const feed = await prisma.calendarFeed.findFirst({ where: { id: feedId, userId } });
  if (!feed) return;
  await prisma.calendarItem.deleteMany({
    where: { userId, sourceTool: FEED_SOURCE_TOOL, sourceRefId: feedId },
  });
  await prisma.calendarFeed.delete({ where: { id: feedId } });
  await recordEvent({
    userId,
    tool: "calendar",
    type: "calendar.feed_removed",
    refId: feedId,
    meta: { name: feed.name },
  });
}
