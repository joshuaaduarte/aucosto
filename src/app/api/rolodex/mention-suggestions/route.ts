import { getViewerContext } from "@/lib/viewer-context";
import { listPersons } from "@/lib/services/rolodex";

export async function GET() {
  // effectiveUserId, not the session id, so demo mode suggests demo people.
  const context = await getViewerContext();
  const userId = context?.effectiveUserId;
  if (!userId) {
    return Response.json({ people: [] }, { status: 401 });
  }

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
