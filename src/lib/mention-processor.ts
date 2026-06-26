import "server-only";

import { parseMentions, parseInsights, RESERVED_MARKERS } from "@/lib/mention-parser";
import {
  ensureRolodexTables,
  findPersonByName,
  createMention,
  resolveMention,
  addInteraction,
} from "@/lib/services/rolodex";
import {
  ensureInsightTables,
  deleteInsightsForSource,
  createInsight,
  linkInsightToPerson,
} from "@/lib/services/captured-insights";
import { prisma } from "@/lib/prisma";

export interface MentionProcessResult {
  resolved: Array<{ name: string; personId: string; interactionId?: string }>;
  unresolved: Array<{ name: string; mentionId: string }>;
  ambiguous: Array<{ name: string; candidates: Array<{ id: string; displayName: string }> }>;
}

// Belt-and-suspenders: use the same reserved set from the parser

/** Strip @insight spans and bare @Name syntax from text so interaction bodies read cleanly. */
function cleanBodyText(text: string): string {
  let cleaned = text.replace(/(?<![a-zA-Z0-9_])@insight\s+[^.!?\n]*[.!?\n]?/gi, "");
  cleaned = cleaned.replace(
    /(?<![a-zA-Z0-9_])@(?:\[([^\]\n]+)\]|([a-zA-Z]\w*)(?:\s+([A-Z]\w*))?)/g,
    (_, bracket, first, second) => bracket ?? (second ? `${first} ${second}` : first ?? ""),
  );
  return cleaned.replace(/\s{2,}/g, " ").trim();
}

/** Return the sentence(s) containing the @mention for use as interaction body. */
function extractSurroundingSentence(text: string, start: number, end: number): string {
  // Find the nearest newline or sentence boundary before `start`
  let sentenceStart = 0;
  for (let i = start - 1; i >= 0; i--) {
    if (text[i] === "\n" || (i > 0 && /[.!?]/.test(text[i]!) && /\s/.test(text[i - 1] ?? " "))) {
      sentenceStart = i + 1;
      break;
    }
  }
  // Find the nearest newline or sentence boundary after `end`
  let sentenceEnd = text.length;
  for (let i = end; i < text.length; i++) {
    if (text[i] === "\n" || /[.!?]/.test(text[i]!)) {
      sentenceEnd = i + 1;
      break;
    }
  }
  return text.slice(sentenceStart, sentenceEnd).trim();
}

/**
 * Look up an existing mention for this exact (userId, sourceTool, sourceRecordId,
 * sourceField, mentionedName) key.  Returns the row if found so callers can check
 * whether it is already resolved — unresolved mentions should be retried when the
 * person is eventually added to the Rolodex.
 */
async function getExistingMention(
  userId: string,
  sourceTool: string,
  sourceRecordId: string,
  sourceField: string,
  mentionedName: string,
): Promise<{ id: string; resolved: boolean; personId: string | null } | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<
      Array<{ id: string; resolved: boolean; personId: string | null }>
    >(
      `SELECT "id", "resolved", "personId" FROM "RolodexMention"
       WHERE "userId" = $1 AND "sourceTool" = $2 AND "sourceRecordId" = $3
         AND "sourceField" = $4 AND "mentionedName" = $5
       LIMIT 1`,
      userId,
      sourceTool,
      sourceRecordId,
      sourceField,
      mentionedName,
    );
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

async function getExistingInteraction(
  userId: string,
  personId: string,
  sourceTool: string,
  sourceRecordId: string,
): Promise<{ id: string } | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT "id" FROM "RolodexInteraction"
       WHERE "userId" = $1 AND "personId" = $2 AND "sourceTool" = $3 AND "sourceRecordId" = $4
       LIMIT 1`,
      userId,
      personId,
      sourceTool,
      sourceRecordId,
    );
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

async function updateInteraction(
  interactionId: string,
  userId: string,
  title: string,
  body: string | null,
  occurredAt: Date,
): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE "RolodexInteraction"
     SET "title" = $1, "body" = $2, "occurredAt" = $3::timestamptz
     WHERE "id" = $4 AND "userId" = $5`,
    title,
    body,
    occurredAt.toISOString(),
    interactionId,
    userId,
  );
}

/**
 * Process @mentions found in a note/text.
 * Safe to call as a fire-and-forget side-effect after a record is saved —
 * always wraps DB failures in console.error and never re-throws.
 */
export async function processMentions(
  userId: string,
  text: string,
  sourceTool: string,
  sourceRecordId: string,
  sourceField: string,
  interactionTitle: string,
  occurredAt?: Date,
): Promise<MentionProcessResult> {
  const result: MentionProcessResult = { resolved: [], unresolved: [], ambiguous: [] };

  if (!text.trim()) return result;

  const mentions = parseMentions(text);
  const insights = parseInsights(text);
  if (mentions.length === 0 && insights.length === 0) return result;

  const at = occurredAt ?? new Date();
  const resolvedPersonIds = new Set<string>();

  // ── Mention processing ────────────────────────────────────────────────
  if (mentions.length > 0) {
    try {
      await ensureRolodexTables();
    } catch (e) {
      console.error("[mention-processor] ensureRolodexTables failed", e);
      return result;
    }

    for (const mention of mentions) {
      const firstWord = mention.name.split(/\s/)[0] ?? "";
      if (RESERVED_MARKERS.has(firstWord.toLowerCase())) {
        console.warn("[mention-processor] skipping reserved marker that slipped through parser:", mention.name);
        continue;
      }
      try {
        const existing = await getExistingMention(
          userId,
          sourceTool,
          sourceRecordId,
          sourceField,
          mention.name,
        );

        if (existing?.resolved && existing.personId) {
          resolvedPersonIds.add(existing.personId);
          continue;
        }

        const candidates = await findPersonByName(userId, mention.name);

        if (candidates.length === 1) {
          const person = candidates[0]!;

          let mentionId: string;
          if (existing) {
            mentionId = existing.id;
            await resolveMention(userId, mentionId, person.id);
          } else {
            mentionId = await createMention(userId, {
              mentionedName: mention.name,
              sourceTool,
              sourceRecordId,
              sourceField,
              personId: person.id,
            });
            await resolveMention(userId, mentionId, person.id);
          }

          const rawBody = extractSurroundingSentence(text, mention.start, mention.end);
          const body = cleanBodyText(rawBody);
          const existingInteraction = await getExistingInteraction(userId, person.id, sourceTool, sourceRecordId);
          let interactionId: string;
          if (existingInteraction) {
            await updateInteraction(existingInteraction.id, userId, interactionTitle, body || null, at);
            interactionId = existingInteraction.id;
          } else {
            interactionId = await addInteraction(userId, person.id, {
              title: interactionTitle,
              body: body || null,
              occurredAt: at.toISOString(),
              sourceTool,
              sourceRecordId,
            });
          }

          resolvedPersonIds.add(person.id);
          result.resolved.push({ name: mention.name, personId: person.id, interactionId });
        } else if (candidates.length === 0) {
          if (!existing) {
            const mentionId = await createMention(userId, {
              mentionedName: mention.name,
              sourceTool,
              sourceRecordId,
              sourceField,
              personId: null,
            });
            result.unresolved.push({ name: mention.name, mentionId });
          } else {
            result.unresolved.push({ name: mention.name, mentionId: existing.id });
          }
        } else {
          const mentionId = existing
            ? existing.id
            : await createMention(userId, {
                mentionedName: mention.name,
                sourceTool,
                sourceRecordId,
                sourceField,
                personId: null,
              });
          result.ambiguous.push({
            name: mention.name,
            candidates: candidates.map((c) => ({ id: c.id, displayName: c.displayName })),
          });
          result.unresolved.push({ name: mention.name, mentionId });
        }
      } catch (e) {
        console.error("[mention-processor] failed processing mention", mention.name, e);
      }
    }
  }

  // ── Insight processing ──────────────────────────────────────────────────
  if (insights.length > 0) {
    try {
      await ensureInsightTables();
      await deleteInsightsForSource(userId, sourceTool, sourceRecordId, sourceField);

      const personIds = [...resolvedPersonIds];
      for (const insight of insights) {
        try {
          const created = await createInsight({
            userId,
            sourceTool,
            sourceRecordId,
            sourceField,
            occurredAt: at,
            text: insight.text,
            kind: insight.kind,
          });
          for (const personId of personIds) {
            await linkInsightToPerson(created.id, personId, userId);
          }
        } catch (e) {
          console.error("[mention-processor] failed creating insight", e);
        }
      }
    } catch (e) {
      console.error("[mention-processor] insight processing failed", e);
    }
  }

  return result;
}

/**
 * Process mentions across multiple fields of a single record.
 * Deduplicates interactions: one time entry = one interaction per person,
 * regardless of whether the mention came from title or notes.
 * Prefers the notes excerpt as the interaction body; falls back to the title.
 */
export async function processMentionsMultiField(
  userId: string,
  fields: { label?: string | null; notes?: string | null },
  sourceTool: string,
  sourceRecordId: string,
  interactionTitle: string,
  occurredAt?: Date,
): Promise<MentionProcessResult> {
  const combined: MentionProcessResult = { resolved: [], unresolved: [], ambiguous: [] };

  // Process notes first (preferred source for interaction body)
  if (fields.notes?.trim()) {
    const notesResult = await processMentions(
      userId,
      fields.notes,
      sourceTool,
      sourceRecordId,
      "notes",
      interactionTitle,
      occurredAt,
    );
    combined.resolved.push(...notesResult.resolved);
    combined.unresolved.push(...notesResult.unresolved);
    combined.ambiguous.push(...notesResult.ambiguous);
  }

  // Process label — dedup against what notes already resolved
  if (fields.label?.trim()) {
    const resolvedNames = new Set(combined.resolved.map((r) => r.name.toLowerCase()));
    const unresolvedNames = new Set(combined.unresolved.map((u) => u.name.toLowerCase()));

    const labelMentions = parseMentions(fields.label);
    const newLabelMentions = labelMentions.filter(
      (m) => !resolvedNames.has(m.name.toLowerCase()) && !unresolvedNames.has(m.name.toLowerCase()),
    );

    if (newLabelMentions.length > 0) {
      const labelResult = await processMentions(
        userId,
        fields.label,
        sourceTool,
        sourceRecordId,
        "label",
        interactionTitle,
        occurredAt,
      );
      // Only add mentions not already covered by notes
      for (const r of labelResult.resolved) {
        if (!resolvedNames.has(r.name.toLowerCase())) {
          combined.resolved.push(r);
        }
      }
      for (const u of labelResult.unresolved) {
        if (!unresolvedNames.has(u.name.toLowerCase())) {
          combined.unresolved.push(u);
        }
      }
      combined.ambiguous.push(...labelResult.ambiguous);
    }
  }

  return combined;
}
