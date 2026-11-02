// Assistant action executor — Rolodex actions.
// (Split out of the former single-file assistant-action-executor.ts.)

import "server-only";
import { findPersonByName, createPerson, updatePerson, addInteraction, getPerson } from "@/lib/services/rolodex";
import { AddGiftIdeaInput, AddPersonFollowupInput, AddRolodexInteractionInput, CreateRolodexPersonInput, UpdateRolodexPersonInput } from "./schemas";
import { err, errAmbiguous, personResolutionError, resolvePersonByName, zodErr } from "./shared";
import { ExecuteResult, PreviewResult } from "./types";

export async function previewCreateRolodexPerson(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = CreateRolodexPersonInput.safeParse(raw);
  if (!parsed.success) return zodErr(parsed.error);

  if (
    parsed.data.birthday &&
    Number.isNaN(new Date(parsed.data.birthday).getTime())
  ) {
    return err(
      `"birthday": "${parsed.data.birthday}" is not a real calendar date — use YYYY-MM-DD (e.g. 1990-05-14)`,
    );
  }

  const warnings: string[] = [];
  const displayName = parsed.data.displayName.trim();
  const matches = await findPersonByName(userId, displayName);
  const duplicate = matches.find(
    (m) => m.displayName.toLowerCase() === displayName.toLowerCase(),
  );
  if (duplicate) {
    warnings.push(
      `A contact named "${duplicate.displayName}" already exists — creating another will duplicate it. Use update_rolodex_person to change the existing contact instead.`,
    );
  }

  const parts: string[] = [`Create contact: ${displayName}`];
  if (parsed.data.relationshipType) parts.push(parsed.data.relationshipType);
  if (parsed.data.organization) parts.push(`@ ${parsed.data.organization}`);

  return {
    ok: true,
    previewText: parts.join(" · "),
    normalizedInput: { ...parsed.data, displayName },
    warnings,
  };
}

export async function executeCreateRolodexPerson(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  const id = await createPerson(userId, {
    displayName: String(n.displayName),
    firstName: n.firstName ? String(n.firstName) : undefined,
    lastName: n.lastName ? String(n.lastName) : undefined,
    relationshipType: n.relationshipType ? String(n.relationshipType) : undefined,
    organization: n.organization ? String(n.organization) : undefined,
    birthday: n.birthday ? String(n.birthday) : undefined,
    notes: n.notes ? String(n.notes) : undefined,
  });
  return { ok: true, recordId: id, recordType: "RolodexPerson", summary: `Created contact "${n.displayName}"` };
}

export async function previewUpdateRolodexPerson(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = UpdateRolodexPersonInput.safeParse(raw);
  if (!parsed.success) return zodErr(parsed.error);

  const resolved = await resolvePersonByName(userId, parsed.data.personName);
  if (!resolved.found) {
    return errAmbiguous(
      personResolutionError(parsed.data.personName, resolved.candidates, resolved.suggestion),
      resolved.candidates,
    );
  }
  const person = resolved.match;

  const changes: string[] = [];
  if (parsed.data.notes !== undefined) changes.push("notes");
  if (parsed.data.relationshipType !== undefined) changes.push(`relationship → ${parsed.data.relationshipType}`);
  if (parsed.data.organization !== undefined) changes.push(`org → ${parsed.data.organization}`);
  if (parsed.data.giftIdeas !== undefined) changes.push("gift ideas");
  if (parsed.data.communicationNotes !== undefined) changes.push("communication notes");
  if (changes.length === 0) return err("No changes specified");

  return {
    ok: true,
    previewText: `Update contact "${person.name}": ${changes.join(", ")}`,
    normalizedInput: { ...parsed.data, personId: person.id, personName: person.name },
    warnings: [],
  };
}

export async function executeUpdateRolodexPerson(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  const patch: Parameters<typeof updatePerson>[2] = {};
  if (n.notes !== undefined) patch.notes = n.notes ? String(n.notes) : null;
  if (n.relationshipType !== undefined) patch.relationshipType = n.relationshipType ? String(n.relationshipType) : null;
  if (n.organization !== undefined) patch.organization = n.organization ? String(n.organization) : null;
  if (n.communicationNotes !== undefined) patch.communicationNotes = n.communicationNotes ? String(n.communicationNotes) : null;
  if (Array.isArray(n.giftIdeas)) {
    const existing = await getPerson(userId, String(n.personId));
    patch.giftIdeas = [...(existing?.giftIdeas ?? []), ...(n.giftIdeas as string[])];
  }

  await updatePerson(userId, String(n.personId), patch);
  return { ok: true, recordId: String(n.personId), recordType: "RolodexPerson", summary: `Updated contact "${n.personName}"` };
}

export async function previewAddRolodexInteraction(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = AddRolodexInteractionInput.safeParse(raw);
  if (!parsed.success) return zodErr(parsed.error);

  const resolved = await resolvePersonByName(userId, parsed.data.personName);
  if (!resolved.found) {
    return errAmbiguous(
      personResolutionError(parsed.data.personName, resolved.candidates, resolved.suggestion),
      resolved.candidates,
    );
  }
  const person = resolved.match;

  const lines = [`Log interaction with "${person.name}": "${parsed.data.title}"`];
  if (parsed.data.followUpNeeded) lines.push(`Follow-up: ${parsed.data.followUpDate ?? "no date set"}`);

  return {
    ok: true,
    previewText: lines.join("\n"),
    normalizedInput: { ...parsed.data, personId: person.id, personName: person.name },
    warnings: [],
  };
}

export async function executeAddRolodexInteraction(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  const id = await addInteraction(userId, String(n.personId), {
    title: String(n.title),
    body: n.body ? String(n.body) : undefined,
    followUpNeeded: Boolean(n.followUpNeeded),
    followUpDate: n.followUpDate ? String(n.followUpDate) : undefined,
    sourceTool: "assistant",
  });
  return { ok: true, recordId: id, recordType: "RolodexInteraction", summary: `Logged interaction with "${n.personName}"` };
}

export async function previewAddPersonFollowup(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = AddPersonFollowupInput.safeParse(raw);
  if (!parsed.success) return zodErr(parsed.error);

  const resolved = await resolvePersonByName(userId, parsed.data.personName);
  if (!resolved.found) {
    return errAmbiguous(
      personResolutionError(parsed.data.personName, resolved.candidates, resolved.suggestion),
      resolved.candidates,
    );
  }
  const person = resolved.match;

  return {
    ok: true,
    previewText: `Add follow-up with "${person.name}": "${parsed.data.title}"${parsed.data.followUpDate ? ` by ${parsed.data.followUpDate}` : ""}`,
    normalizedInput: { ...parsed.data, personId: person.id, personName: person.name },
    warnings: [],
  };
}

export async function executeAddPersonFollowup(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  const id = await addInteraction(userId, String(n.personId), {
    title: String(n.title),
    followUpNeeded: true,
    followUpDate: n.followUpDate ? String(n.followUpDate) : undefined,
    sourceTool: "assistant",
  });
  return { ok: true, recordId: id, recordType: "RolodexInteraction", summary: `Added follow-up with "${n.personName}"` };
}

export async function previewAddGiftIdea(
  userId: string,
  raw: unknown,
): Promise<PreviewResult> {
  const parsed = AddGiftIdeaInput.safeParse(raw);
  if (!parsed.success) return zodErr(parsed.error);

  const resolved = await resolvePersonByName(userId, parsed.data.personName);
  if (!resolved.found) {
    return errAmbiguous(
      personResolutionError(parsed.data.personName, resolved.candidates, resolved.suggestion),
      resolved.candidates,
    );
  }
  const person = resolved.match;

  const warnings: string[] = [];
  const existing = await getPerson(userId, person.id);
  if (
    existing?.giftIdeas.some(
      (g) => g.toLowerCase() === parsed.data.idea.trim().toLowerCase(),
    )
  ) {
    warnings.push(
      `Gift idea "${parsed.data.idea.trim()}" is already saved for "${person.name}" — adding it again will create a duplicate`,
    );
  }

  return {
    ok: true,
    previewText: `Add gift idea for "${person.name}": "${parsed.data.idea}"`,
    normalizedInput: { ...parsed.data, personId: person.id, personName: person.name },
    warnings,
  };
}

export async function executeAddGiftIdea(
  userId: string,
  n: Record<string, unknown>,
): Promise<ExecuteResult> {
  const existing = await getPerson(userId, String(n.personId));
  const updated = [...(existing?.giftIdeas ?? []), String(n.idea)];
  await updatePerson(userId, String(n.personId), { giftIdeas: updated });
  return { ok: true, recordId: String(n.personId), recordType: "RolodexPerson", summary: `Added gift idea for "${n.personName}"` };
}

// ── Error helpers ─────────────────────────────────────────────────────────
