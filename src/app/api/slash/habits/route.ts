import { auth } from "@/auth";
import { listHabits } from "@/lib/services/habits";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ habits: [] }, { status: 401 });
  }

  const habits = await listHabits(userId, { includeArchived: false }).catch(() => []);
  return Response.json({
    habits: habits.map((habit) => ({ id: habit.id, name: habit.title })),
  });
}
