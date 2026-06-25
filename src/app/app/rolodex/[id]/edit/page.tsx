import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveActiveUserId } from "@/lib/viewer-context";
import { ensureRolodexTables, getPerson } from "@/lib/services/rolodex";
import { EditPersonForm } from "./_edit-form";

export const dynamic = "force-dynamic";

export default async function EditPersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  try {
    await ensureRolodexTables();
  } catch {
    // degrade gracefully
  }

  const { id } = await params;
  const userId = await resolveActiveUserId();
  const person = await getPerson(userId, id).catch(() => null);
  if (!person) notFound();

  return (
    <div className="space-y-6">
      <header className="fade-in">
        <Link
          href={`/app/rolodex/${id}`}
          className="inline-flex items-center gap-1 text-[0.8125rem] font-medium hover:underline"
          style={{ color: "var(--text-muted)" }}
        >
          ← {person.displayName}
        </Link>
        <h1
          className="mt-2 text-[1.5rem] font-bold tracking-tight"
          style={{ color: "var(--text)", letterSpacing: "-0.025em" }}
        >
          Edit contact
        </h1>
      </header>

      <EditPersonForm id={id} person={person} />
    </div>
  );
}
