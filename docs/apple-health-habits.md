# Apple Health → habits

An iPhone Shortcut sends the day's Apple Health totals to Aucosto, and every
habit linked to a measure fills itself in. Sending the same day again
replaces that day's earlier numbers, so the Shortcut can run as often as you
like.

## 1. Link habits

Habits → open a habit → edit → **Fill from Apple Health**. The picker
suggests a measure from the title (steps, workouts, weight, sleep, mindful
minutes).

| Habit goal | What it gets |
| --- | --- |
| Count (e.g. 10,000 steps) | The number itself: 8,275 steps shows 83% |
| Minutes | Minutes (sleep hours are turned into minutes) |
| Check (done or not) | Done when the measure shows it happened (sleep: 7h or more) |

This needs `scripts/create-habit-preferences.sql` applied once.

## 2. The Shortcut

Token: `HEALTH_WEBHOOK_SECRET` in Vercel. If it isn't set, the existing
`LOCATION_WEBHOOK_SECRET` works.

In the Shortcuts app, make a shortcut named "Aucosto health":

1. **Find Health Samples** where Type is Steps, Start Date is Today. Then
   **Calculate Statistics** (Sum) gives the steps total.
2. Repeat for any of: Exercise Minutes (Sum), Mindful Minutes (Sum), Workouts
   (Find Workouts, Start Date is Today, then Count), Weight (Find Health
   Samples, Type Weight, Start Date is Today, then Count), Sleep (Sleep
   Analysis, Start Date is in the last 1 day, then Sum of Duration in hours).
3. **Get Contents of URL**: `https://aucosto.com/api/apple-health`, Method
   POST, header `Authorization: Bearer <token>`, Request Body JSON with keys
   `steps`, `exerciseMinutes`, `workouts`, `weight`, `sleepHours` and
   `mindfulMinutes`. Leave out any key you don't track.

Then Automation → New → **Time of Day** at 9:00 PM (and optionally 12:00 PM),
set to Run Immediately, and pick the shortcut. To send yesterday's numbers
add `"date": "YYYY-MM-DD"`.

The response lists what changed: `{"ok":true,"applied":[{"habit":"👟 10,000 steps","quantity":8275}]}`.
