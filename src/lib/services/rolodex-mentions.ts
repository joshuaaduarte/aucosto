import "server-only";

import { prisma } from "@/lib/prisma";
import { ensureRolodexTables, listPersons } from "@/lib/services/rolodex";

export type MentionSourceTool =
  | "calendar"
  | "time"
  | "reflect"
  | "projects"
  | "do";

type MentionSyncInput = {
  sourceTool: MentionSourceTool;
  sourceRecordId: string;
  sourceField: string;
  text?: string | null;
};

const MENTION_PATTERN = /(^|[\s([{])(?:@\[([^\]\n]{1,120})\]|@([A-Za-z][A-Za-z0-9.'-]{0,119}))/g;

export function extractRolodexMentions(text?: string | null): string[] {
  if (!text) return [];
  const names = new Set<string>();
  for (const match of text.matchAll(MENTION_PATTERN)) {
    const raw = (match[2] ?? match[3])?.trim().replace(/[.,;:!?)]$/, "");
    if (raw && raw.length <= 120) names.add(raw);
  }
  return [...names];
}

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function syncRolodexMentionsForText(
  userId: string,
  input: MentionSyncInput,
): Promise<void> {
  const names = extractRolodexMentions(input.text);
  try {
    await ensureRolodexTables();
    await prisma.$executeRawUnsafe(
      `DELETE FROM "RolodexMention"
       WHERE "userId" = $1
         AND "sourceTool" = $2
         AND "sourceRecordId" = $3
         AND COALESCE("sourceField", '') = $4`,
      userId,
      input.sourceTool,
      input.sourceRecordId,
      input.sourceField,
    );
    if (names.length === 0) return;

    const people = await listPersons(userId);
    const exact = new Map<string, string>();
    for (const person of people) {
      exact.set(normalizeName(person.displayName), person.id);
      for (const alias of person.aliases) exact.set(normalizeName(alias), person.id);
    }

    for (const name of names) {
      const personId = exact.get(normalizeName(name)) ?? null;
      await prisma.$executeRawUnsafe(
        `INSERT INTO "RolodexMention" (
           "id","userId","personId","mentionedName","resolved",
           "sourceTool","sourceRecordId","sourceField","createdAt"
         ) VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,NOW())`,
        userId,
        personId,
        name,
        personId !== null,
        input.sourceTool,
        input.sourceRecordId,
        input.sourceField,
      );
    }
  } catch (error) {
    console.error("[rolodex] syncRolodexMentionsForText failed", error);
  }
}
