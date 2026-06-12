// Public surface of the insights derive library. Pure modules only — data
// fetching stays in services / pages.

export * from "./shared";
export * from "./trends";
export {
  buildDayFacts,
  deriveAllPatterns,
  type DayFacts,
  type PatternBar,
  type PatternFinding,
} from "./patterns";
export {
  deriveInsightOfTheDay,
  estimationSparkline,
  weeklyTrackedSparkline,
  type DailyInsight,
  type EstimationSparkline,
  type WeeklySparkline,
} from "./daily";
