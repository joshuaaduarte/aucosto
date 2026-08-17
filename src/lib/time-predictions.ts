export type TimePrediction = {
  key: string;
  label: string;
  category: string;
  confidence: number;
  reason: string;
};

type CalendarLike = {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  status: string;
  allDay: boolean;
};

type RecentLike = {
  label: string;
  category: string | null;
  startedAt: Date;
};

type HabitLike = {
  id: string;
  title: string;
  dueToday: boolean;
  completedToday: boolean;
  keptAliveToday?: boolean;
  reminderTime: string | null;
};

function isWeekend(date: Date) {
  return date.getDay() === 0 || date.getDay() === 6;
}

function minutesOfDay(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function pushUnique(predictions: TimePrediction[], prediction: TimePrediction) {
  const existing = predictions.find(
    (item) => item.label.toLowerCase() === prediction.label.toLowerCase(),
  );
  if (!existing) {
    predictions.push(prediction);
  } else if (prediction.confidence > existing.confidence) {
    Object.assign(existing, prediction);
  }
}

export function predictCurrentTimeOptions(input: {
  now: Date;
  calendarItems?: CalendarLike[];
  habits?: HabitLike[];
  recents?: RecentLike[];
  limit?: number;
}): TimePrediction[] {
  const now = input.now;
  const minute = minutesOfDay(now);
  const predictions: TimePrediction[] = [];

  for (const item of input.calendarItems ?? []) {
    if (item.allDay || item.status === "done" || item.status === "cancelled") continue;
    if (item.startsAt <= now && item.endsAt > now) {
      pushUnique(predictions, {
        key: `calendar:${item.id}`,
        label: item.title,
        category: "calendar",
        confidence: 92,
        reason: "calendar now",
      });
    }
  }

  if (!isWeekend(now)) {
    if (minute >= 9 * 60 && minute < 17 * 60) {
      pushUnique(predictions, {
        key: "baseline:work",
        label: "Work",
        category: "work",
        confidence: 76,
        reason: "weekday 9-5",
      });
    } else if ((minute >= 7 * 60 + 30 && minute < 9 * 60) || (minute >= 17 * 60 && minute < 18 * 60 + 30)) {
      pushUnique(predictions, {
        key: "baseline:commute",
        label: "Commute",
        category: "commute",
        confidence: 68,
        reason: "commute window",
      });
    }
  }

  for (const habit of input.habits ?? []) {
    if (!habit.dueToday || habit.completedToday || habit.keptAliveToday) continue;
    if (!habit.reminderTime) continue;
    const [rawHour, rawMinute] = habit.reminderTime.split(":").map(Number);
    const hour = rawHour ?? NaN;
    const minutePart = rawMinute ?? NaN;
    if (!Number.isFinite(hour) || !Number.isFinite(minutePart)) continue;
    const reminder = hour * 60 + minutePart;
    const distance = Math.abs(minutesOfDay(now) - reminder);
    if (distance <= 90) {
      pushUnique(predictions, {
        key: `habit:${habit.id}`,
        label: habit.title,
        category: "habit",
        confidence: Math.max(54, 72 - Math.floor(distance / 10)),
        reason: "habit due near now",
      });
    }
  }

  const recentByLabel = new Map<string, RecentLike>();
  for (const recent of input.recents ?? []) {
    const key = recent.label.trim().toLowerCase();
    if (!key || recentByLabel.has(key)) continue;
    recentByLabel.set(key, recent);
    if (recentByLabel.size >= 3) break;
  }
  for (const recent of recentByLabel.values()) {
    pushUnique(predictions, {
      key: `recent:${recent.label}`,
      label: recent.label,
      category: recent.category ?? "uncategorized",
      confidence: 42,
      reason: "recently tracked",
    });
  }

  return predictions
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, input.limit ?? 3);
}
