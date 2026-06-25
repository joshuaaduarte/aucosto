import { auth } from "@/auth";
import { ensureRolodexTables, listPersons } from "@/lib/services/rolodex";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ people: [] }, { status: 401 });
  }

  await ensureRolodexTables().catch(() => {});
  const people = await listPersons(userId).catch(() => []);
  return Response.json({
    people: people.slice(0, 25).map((person) => ({
      id: person.id,
      displayName: person.displayName,
      aliases: person.aliases,
      relationshipType: person.relationshipType,
      organization: person.organization,
    })),
  });
}
