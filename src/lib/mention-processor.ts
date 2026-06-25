import "server-only";

import { parseMentions } from "@/lib/mention-parser";
import {
  ensureRolodexTables,
  findPersonByName,
  createMention,
  resolveMention,
  addInteraction,
} from "@/lib/services/rolodex";
import { prisma } from "@/lib/prisma";

export interface MentionProcessResult {
  resolved: Array<{ name: string; personId: string; interactionId?: string }>;
  unresolved: Array<{ name: string; mentionId: string }>;
  ambiguous: Array<{ name: string; candidates: Array<{ id: string; displayName: string }> }>;
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
  if (mentions.length === 0) return result;

  try {
    await ensureRolodexTables();
  } catch (e) {
    console.error("[mention-processor] ensureRolodexTables failed", e);
    return result;
  }

  const at = occurredAt ?? new Date();

  for (const mention of mentions) {
    try {
      const existing = await getExistingMention(
        userId,
        sourceTool,
        sourceRecordId,
        sourceField,
        mention.name,
      );

      // Already fully resolved — nothing more to do for this mention.
      if (existing?.resolved) continue;

      // If unresolved mention exists, re-try the person lookup so that a person
      // added to the Rolodex after the note was first saved gets linked.
      const candidates = await findPersonByName(userId, mention.name);

      if (candidates.length === 1) {
        const person = candidates[0]!;

        let mentionId: string;
        if (existing) {
          // Reuse the unresolved mention row — just resolve it in-place.
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

        const body = extractSurroundingSentence(text, mention.start, mention.end);
        const interactionId = await addInteraction(userId, person.id, {
          title: interactionTitle,
          body: body || null,
          occurredAt: at.toISOString(),
          sourceTool,
          sourceRecordId,
        });

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
        // Ambiguous — more than one person matches.
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

  return result;
}
