"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const startSchema = z.object({
  label: z.string().trim().min(1, "Label is required").max(200),
  category: z.string().trim().max(80).optional(),
});

export type StartState = { error?: string } | undefined;

export async function startEntry(
  _prev: StartState,
  formData: FormData,
): Promise<StartState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Not signed in." };

  const parsed = startSchema.safeParse({
    label: formData.get("label") ?? "",
    category: (formData.get("category") as string) || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  await prisma.timeEntry.updateMany({
    where: { userId: session.user.id, endedAt: null },
    data: { endedAt: new Date() },
  });

  await prisma.timeEntry.create({
    data: {
      userId: session.user.id,
      label: parsed.data.label,
      category: parsed.data.category ?? null,
      startedAt: new Date(),
    },
  });

  revalidatePath("/app");
  revalidatePath("/app/time");
}

export async function stopEntry() {
  const session = await auth();
  if (!session?.user?.id) return;

  await prisma.timeEntry.updateMany({
    where: { userId: session.user.id, endedAt: null },
    data: { endedAt: new Date() },
  });

  revalidatePath("/app");
  revalidatePath("/app/time");
}

export async function deleteEntry(id: string) {
  const session = await auth();
  if (!session?.user?.id) return;

  await prisma.timeEntry.deleteMany({
    where: { id, userId: session.user.id },
  });

  revalidatePath("/app");
  revalidatePath("/app/time");
}
