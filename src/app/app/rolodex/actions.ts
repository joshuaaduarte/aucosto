"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { resolveActiveUserId } from "@/lib/viewer-context";
import {
  createPerson,
  updatePerson,
  addInteraction,
  resolveMention,
  type CreatePersonInput,
} from "@/lib/services/rolodex";

function revalidateRolodex(id?: string) {
  revalidatePath("/app");
  revalidatePath("/app/rolodex");
  if (id) revalidatePath(`/app/rolodex/${id}`);
}

export type RolodexFormState = { error?: string } | undefined;

const personSchema = z.object({
  displayName: z.string().trim().min(1, "Display name is required").max(200),
  firstName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().max(100).optional(),
  relationshipType: z.string().trim().max(50).optional(),
  organization: z.string().trim().max(200).optional(),
  role: z.string().trim().max(200).optional(),
  birthday: z.string().trim().optional(),
  notes: z.string().trim().max(5000).optional(),
});

function readPersonForm(formData: FormData): ReturnType<typeof personSchema.safeParse> {
  return personSchema.safeParse({
    displayName: formData.get("displayName") ?? "",
    firstName: (formData.get("firstName") as string) || undefined,
    lastName: (formData.get("lastName") as string) || undefined,
    relationshipType: (formData.get("relationshipType") as string) || undefined,
    organization: (formData.get("organization") as string) || undefined,
    role: (formData.get("role") as string) || undefined,
    birthday: (formData.get("birthday") as string) || undefined,
    notes: (formData.get("notes") as string) || undefined,
  });
}

function personInputFromParsed(data: z.infer<typeof personSchema>): CreatePersonInput {
  return {
    displayName: data.displayName,
    firstName: data.firstName || null,
    lastName: data.lastName || null,
    relationshipType: data.relationshipType || null,
    organization: data.organization || null,
    role: data.role || null,
    birthday: data.birthday || null,
    notes: data.notes || null,
  };
}

export async function createPersonAction(
  _prev: RolodexFormState,
  formData: FormData,
): Promise<RolodexFormState> {
  let userId: string;
  try {
    userId = await resolveActiveUserId();
  } catch {
    return { error: "Not signed in." };
  }

  const parsed = readPersonForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  let newId: string;
  try {
    newId = await createPerson(userId, personInputFromParsed(parsed.data));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create contact." };
  }

  revalidateRolodex(newId);
  redirect(`/app/rolodex/${newId}`);
}

export async function updatePersonAction(
  _prev: RolodexFormState,
  formData: FormData,
): Promise<RolodexFormState> {
  let userId: string;
  try {
    userId = await resolveActiveUserId();
  } catch {
    return { error: "Not signed in." };
  }

  const id = (formData.get("id") as string) || "";
  if (!id) return { error: "Missing person id." };

  const parsed = readPersonForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    await updatePerson(userId, id, personInputFromParsed(parsed.data));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update contact." };
  }

  revalidateRolodex(id);
  redirect(`/app/rolodex/${id}`);
}

const interactionSchema = z.object({
  personId: z.string().min(1),
  title: z.string().trim().min(1, "Title is required").max(300),
  body: z.string().trim().max(5000).optional(),
  followUpNeeded: z.boolean().optional(),
  followUpDate: z.string().trim().optional(),
});

export type AddInteractionResult = { ok: true } | { ok: false; error: string };

export async function addInteractionAction(
  personId: string,
  title: string,
  body?: string,
  followUpNeeded?: boolean,
  followUpDate?: string,
): Promise<AddInteractionResult> {
  let userId: string;
  try {
    userId = await resolveActiveUserId();
  } catch {
    return { ok: false, error: "Not signed in." };
  }
  const parsed = interactionSchema.safeParse({ personId, title, body, followUpNeeded, followUpDate });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  try {
    await addInteraction(userId, personId, {
      title: parsed.data.title,
      body: parsed.data.body || null,
      followUpNeeded: parsed.data.followUpNeeded ?? false,
      followUpDate: parsed.data.followUpDate || null,
    });
    revalidateRolodex(personId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not add interaction." };
  }
}

export async function resolveMentionAction(
  mentionId: string,
  personId: string,
): Promise<AddInteractionResult> {
  let userId: string;
  try {
    userId = await resolveActiveUserId();
  } catch {
    return { ok: false, error: "Not signed in." };
  }
  try {
    await resolveMention(userId, mentionId, personId);
    revalidateRolodex();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not resolve mention." };
  }
}

export type MentionActionResult = { ok: boolean; personId?: string; error?: string };

/** Create a new RolodexPerson from an unresolved mention and mark the mention resolved. */
export async function createPersonFromMentionAction(
  mentionId: string,
  displayName: string,
): Promise<MentionActionResult> {
  let userId: string;
  try {
    userId = await resolveActiveUserId();
  } catch {
    return { ok: false, error: "Not signed in." };
  }
  const name = displayName.trim();
  if (!name) return { ok: false, error: "Display name is required." };
  try {
    const personId = await createPerson(userId, { displayName: name });
    await resolveMention(userId, mentionId, personId);
    revalidateRolodex(personId);
    return { ok: true, personId };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not create contact." };
  }
}

/** Link an existing unresolved mention to an existing person and mark it resolved. */
export async function linkMentionToPersonAction(
  mentionId: string,
  personId: string,
): Promise<MentionActionResult> {
  let userId: string;
  try {
    userId = await resolveActiveUserId();
  } catch {
    return { ok: false, error: "Not signed in." };
  }
  if (!mentionId || !personId) return { ok: false, error: "Missing ids." };
  try {
    await resolveMention(userId, mentionId, personId);
    revalidateRolodex(personId);
    return { ok: true, personId };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not link mention." };
  }
}
