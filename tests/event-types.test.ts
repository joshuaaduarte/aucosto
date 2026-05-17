import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { describeEventType } from "@/lib/event-types";

// Sweep every "tool.verb" event-type string the services emit and assert the
// label registry covers it. Saves us from the activity widget silently
// rendering raw "finance.foo_bar" strings the next time someone adds a new
// event without updating event-types.ts.

const SERVICE_PATHS = [
  "src/lib/services",
  "src/app/app",
  "src/lib/demo-workspace.ts",
];

function collectEventTypes(): Set<string> {
  const types = new Set<string>();
  const seen = new Set<string>();

  function visit(path: string) {
    if (seen.has(path)) return;
    seen.add(path);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      for (const child of readdirSync(path)) visit(join(path, child));
      return;
    }
    if (!/\.(ts|tsx)$/.test(path)) return;
    const text = readFileSync(path, "utf8");
    for (const match of text.matchAll(/type:\s*"((?:time|finance|user|events)\.[a-z_]+)"/g)) {
      types.add(match[1]!);
    }
  }

  for (const root of SERVICE_PATHS) {
    visit(root);
  }
  return types;
}

describe("describeEventType", () => {
  it("has a label for every event type the services emit", () => {
    const emitted = collectEventTypes();
    expect(emitted.size).toBeGreaterThan(0);

    const missing: string[] = [];
    for (const type of emitted) {
      if (describeEventType(type) === type) {
        missing.push(type);
      }
    }

    expect(missing, `missing labels: ${missing.join(", ")}`).toEqual([]);
  });

  it("falls back to the raw type when an unknown event is passed", () => {
    expect(describeEventType("future.unseen_event")).toBe("future.unseen_event");
  });
});
