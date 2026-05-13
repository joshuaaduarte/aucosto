"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseTransactionsCsv } from "@/lib/csv";

export type UploadState =
  | { ok: true; imported: number; skipped: number }
  | { ok: false; error: string }
  | undefined;

export async function uploadCsv(
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Not signed in." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Pick a CSV file first." };
  }
  if (file.size > 5_000_000) {
    return { ok: false, error: "File is over 5MB; split it first." };
  }

  const text = await file.text();
  const { rows, skipped } = parseTransactionsCsv(text);

  if (rows.length === 0) {
    return {
      ok: false,
      error:
        "No transactions parsed. Need a header row with Date, Amount (or Debit/Credit), and Description.",
    };
  }

  await prisma.transaction.createMany({
    data: rows.map((r) => ({
      userId: session.user.id,
      date: r.date,
      amount: r.amount,
      description: r.description,
      account: r.account,
      raw: r.raw,
    })),
  });

  revalidatePath("/app");
  revalidatePath("/app/finance");
  return { ok: true, imported: rows.length, skipped };
}

export async function deleteAllTransactions() {
  const session = await auth();
  if (!session?.user?.id) return;

  await prisma.transaction.deleteMany({
    where: { userId: session.user.id },
  });

  revalidatePath("/app");
  revalidatePath("/app/finance");
}
