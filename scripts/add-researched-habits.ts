import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

type HabitSeed = {
  title: string;
  bucket: string;
  notes: string;
  fallbackTitle?: string;
  rescuePrompt?: string;
  dayPart: "morning" | "day" | "evening" | "anytime";
  cadence: "daily" | "weekdays" | "weekly" | "custom";
  daysOfWeek?: string | null;
  targetCount: number;
  goalUnit: "check" | "minutes" | "steps";
  defaultDurationMinutes?: number | null;
  reminderTime?: string | null;
};

const databaseUrl = process.env.DATABASE_URL;
const email = process.env.SEED_USER_EMAIL ?? "joshua.duarte151@gmail.com";

if (!databaseUrl) {
  throw new Error("DATABASE_URL not set");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

const habits: HabitSeed[] = [
  {
    title: "Wake anchor",
    bucket: "sleep",
    notes:
      "Wake inside the target window to protect the whole day. Best paired with immediate water and getting outside.",
    fallbackTitle: "Run recovery morning mode",
    rescuePrompt: "Late is not dead. Water, light, one physical win, one work win before noon.",
    dayPart: "morning",
    cadence: "daily",
    targetCount: 1,
    goalUnit: "check",
    reminderTime: "05:00",
  },
  {
    title: "Night shutdown",
    bucket: "sleep",
    notes:
      "Start landing on time so tomorrow is easier. Close with clothes out, phone away, and tomorrow's top 1 picked.",
    fallbackTitle: "3-minute shutdown",
    rescuePrompt: "Protect tomorrow now: clothes out, phone away, top 1 chosen.",
    dayPart: "evening",
    cadence: "daily",
    targetCount: 1,
    goalUnit: "check",
    defaultDurationMinutes: 10,
    reminderTime: "21:30",
  },
  {
    title: "Morning light + Arlo",
    bucket: "health",
    notes:
      "Get outside within 30 to 60 minutes of waking. Tie this to Arlo so the habit starts itself.",
    fallbackTitle: "10-minute outside walk",
    rescuePrompt: "Get outside now, even if the full run is gone.",
    dayPart: "morning",
    cadence: "daily",
    targetCount: 1,
    goalUnit: "check",
    defaultDurationMinutes: 20,
    reminderTime: "05:20",
  },
  {
    title: "Daily movement floor",
    bucket: "health",
    notes:
      "Hit the minimum every day so momentum survives imperfect days. Intentional movement matters more than perfection.",
    fallbackTitle: "10-minute walk",
    rescuePrompt: "Keep the habit alive with ten minutes instead of skipping the day.",
    dayPart: "day",
    cadence: "daily",
    targetCount: 20,
    goalUnit: "minutes",
    defaultDurationMinutes: 20,
    reminderTime: "18:30",
  },
  {
    title: "Planned training",
    bucket: "training",
    notes:
      "Complete the planned run, lift, or conditioning sessions for the week. This is the real training system, not random effort.",
    fallbackTitle: "20-minute training save",
    rescuePrompt: "The full session can slip, but the week does not have to. Save it with a shorter session.",
    dayPart: "evening",
    cadence: "weekly",
    targetCount: 4,
    goalUnit: "check",
    defaultDurationMinutes: 45,
    reminderTime: "17:45",
  },
  {
    title: "Evening top 1 plan",
    bucket: "planning",
    notes:
      "Choose the next meaningful task ahead of time and define the if-then trigger so the evening starts with action instead of drift.",
    fallbackTitle: "Pick the smallest next step",
    rescuePrompt: "Write the one next move before YouTube gets the night.",
    dayPart: "evening",
    cadence: "daily",
    targetCount: 1,
    goalUnit: "check",
    defaultDurationMinutes: 10,
    reminderTime: "19:15",
  },
  {
    title: "Phone parked",
    bucket: "focus",
    notes:
      "Put the phone out of reach during the drift window so the night stops getting stolen by default behavior.",
    fallbackTitle: "Park phone for 10 minutes",
    rescuePrompt: "Protect tomorrow now. Phone away, even if the night already slipped a bit.",
    dayPart: "evening",
    cadence: "daily",
    targetCount: 1,
    goalUnit: "check",
    reminderTime: "21:15",
  },
  {
    title: "5-minute reset",
    bucket: "recovery",
    notes:
      "Use this after a bad morning, stressful workday, or before an evening build block to stop the spiral early.",
    fallbackTitle: "1-minute reset",
    rescuePrompt: "Pause, breathe, and reset before the spiral decides the rest of the day.",
    dayPart: "day",
    cadence: "daily",
    targetCount: 5,
    goalUnit: "minutes",
    defaultDurationMinutes: 5,
    reminderTime: "12:30",
  },
];

async function main() {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });

  if (!user) {
    throw new Error(`User not found for ${email}`);
  }

  const summary: Array<{ title: string; status: "created" | "updated" }> = [];

  for (const habit of habits) {
    const existing = await prisma.habit.findFirst({
      where: {
        userId: user.id,
        title: habit.title,
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.habit.update({
        where: { id: existing.id },
        data: {
          bucket: habit.bucket,
          notes: habit.notes,
          fallbackTitle: habit.fallbackTitle ?? null,
          rescuePrompt: habit.rescuePrompt ?? null,
          dayPart: habit.dayPart,
          cadence: habit.cadence,
          daysOfWeek: habit.daysOfWeek ?? null,
          targetCount: habit.targetCount,
          goalUnit: habit.goalUnit,
          defaultDurationMinutes: habit.defaultDurationMinutes ?? null,
          reminderTime: habit.reminderTime ?? null,
          archivedAt: null,
        },
      });
      summary.push({ title: habit.title, status: "updated" });
      continue;
    }

    await prisma.habit.create({
      data: {
        userId: user.id,
        title: habit.title,
        bucket: habit.bucket,
        notes: habit.notes,
        fallbackTitle: habit.fallbackTitle ?? null,
        rescuePrompt: habit.rescuePrompt ?? null,
        dayPart: habit.dayPart,
        cadence: habit.cadence,
        daysOfWeek: habit.daysOfWeek ?? null,
        targetCount: habit.targetCount,
        goalUnit: habit.goalUnit,
        defaultDurationMinutes: habit.defaultDurationMinutes ?? null,
        reminderTime: habit.reminderTime ?? null,
      },
    });
    summary.push({ title: habit.title, status: "created" });
  }

  console.log(
    JSON.stringify(
      {
        user: user.email,
        summary,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
