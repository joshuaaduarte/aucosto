import { getViewerContext } from "@/lib/viewer-context";
import { listHabits } from "@/lib/services/habits";

export async function GET() {
  // effectiveUserId, not the session id, so demo mode suggests demo habits.
  const context = await getViewerContext();
  if (!context) {
    return Response.json({ habits: [] }, { status: 401 });
  }

  const habits = await listHabits(context.effectiveUserId, { includeArchived: false }).catch(
    () => [],
  );
  return Response.json({
    habits: habits.map((habit) => ({ id: habit.id, name: habit.title })),
  });
}
