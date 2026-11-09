-- One-off data cleanup, safe to re-run. Two fixes from the calendar/time/habits
-- plan (Nov 2026):
--
-- 1. Agent-written reflections used to get a made-up mood of 3/5 when the
--    agent saved a note without a mood. Those days now read as "not rated":
--    we set contextSnapshot.ratingsUnset = true, which the reflect service
--    turns into null ratings. Only days where every rating is 3 AND every
--    add_reflection audit for that day carried no mood are touched, so a
--    day someone actually rated keeps its numbers.
-- 2. "Read" duplicates "📖 Read". The plain one is archived (history kept).
--
-- Preview first (read-only):
--   SELECT to_char(r."date", 'YYYY-MM-DD'), r."mood" FROM "DailyReflection" r ... (same WHERE as below)
-- Apply:
--   npx tsx --env-file=.env scripts/apply-sql.ts scripts/clear-agent-default-moods.sql

UPDATE "DailyReflection" r
SET "contextSnapshot" = jsonb_set(
      COALESCE(r."contextSnapshot"::jsonb, '{}'::jsonb),
      '{ratingsUnset}',
      'true'::jsonb
    ),
    "updatedAt" = NOW()
WHERE r."mood" = 3
  AND r."energyLevel" = 3
  AND r."productivityRating" = 3
  AND r."dayRating" = 3
  AND COALESCE(r."contextSnapshot"::jsonb ->> 'ratingsUnset', 'false') <> 'true'
  AND EXISTS (
    SELECT 1 FROM assistant_action_audits a
    WHERE a.user_id = r."userId"
      AND a.action = 'add_reflection'
      AND a.status = 'executed'
      AND a.preview_text = 'Updated reflection for ' || to_char(r."date", 'YYYY-MM-DD')
      AND a.normalized_input ->> 'mood' IS NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM assistant_action_audits a
    WHERE a.user_id = r."userId"
      AND a.action = 'add_reflection'
      AND a.status = 'executed'
      AND a.preview_text = 'Updated reflection for ' || to_char(r."date", 'YYYY-MM-DD')
      AND a.normalized_input ->> 'mood' IS NOT NULL
  );

-- Archive the plain "Read" habit only when an emoji "📖 Read" exists for the
-- same user, so nobody's only reading habit disappears.
UPDATE "Habit" h
SET "archivedAt" = NOW(), "updatedAt" = NOW()
WHERE h."title" = 'Read'
  AND h."archivedAt" IS NULL
  AND EXISTS (
    SELECT 1 FROM "Habit" o
    WHERE o."userId" = h."userId"
      AND o."title" = '📖 Read'
      AND o."archivedAt" IS NULL
  );
