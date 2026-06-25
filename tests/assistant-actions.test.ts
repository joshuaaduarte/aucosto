import { describe, expect, it } from "vitest";
import { ACTION_REGISTRY } from "@/lib/assistant-actions";

describe("ACTION_REGISTRY", () => {
  it("create_task has low risk", () => {
    expect(ACTION_REGISTRY["create_task"]!.risk).toBe("low");
  });

  it("create_task does not require confirmation", () => {
    expect(ACTION_REGISTRY["create_task"]!.confirmationRequired).toBe(false);
  });

  it("create_task is supported", () => {
    expect(ACTION_REGISTRY["create_task"]!.supported).toBe(true);
  });

  it("log_habit has low risk", () => {
    expect(ACTION_REGISTRY["log_habit"]!.risk).toBe("low");
  });

  it("add_reflection has low risk", () => {
    expect(ACTION_REGISTRY["add_reflection"]!.risk).toBe("low");
  });

  it("stop_timer requires confirmation", () => {
    expect(ACTION_REGISTRY["stop_timer"]!.confirmationRequired).toBe(true);
  });

  it("stop_timer has medium risk", () => {
    expect(ACTION_REGISTRY["stop_timer"]!.risk).toBe("medium");
  });

  it("complete_task requires confirmation", () => {
    expect(ACTION_REGISTRY["complete_task"]!.confirmationRequired).toBe(true);
  });

  it("update_task has medium risk", () => {
    expect(ACTION_REGISTRY["update_task"]!.risk).toBe("medium");
  });

  it("finance_write is not supported", () => {
    expect(ACTION_REGISTRY["finance_write"]!.supported).toBe(false);
  });

  it("finance_write has high risk", () => {
    expect(ACTION_REGISTRY["finance_write"]!.risk).toBe("high");
  });

  it("all supported actions have descriptions", () => {
    for (const [key, def] of Object.entries(ACTION_REGISTRY)) {
      expect(def.description.length, `${key} missing description`).toBeGreaterThan(0);
    }
  });
});

describe("medium-risk confirmation gate logic", () => {
  // Pure gate logic: medium-risk actions with confirmed !== true must be rejected.
  // This mirrors the logic in execute/route.ts without importing the route.
  function wouldRequireConfirmation(
    action: string,
    confirmed: unknown,
  ): boolean {
    const def = ACTION_REGISTRY[action];
    if (!def) return false;
    return def.confirmationRequired && confirmed !== true;
  }

  it("stop_timer without confirmed:true requires confirmation", () => {
    expect(wouldRequireConfirmation("stop_timer", undefined)).toBe(true);
  });

  it("stop_timer with confirmed:true does NOT require confirmation", () => {
    expect(wouldRequireConfirmation("stop_timer", true)).toBe(false);
  });

  it("stop_timer with confirmed:false requires confirmation", () => {
    expect(wouldRequireConfirmation("stop_timer", false)).toBe(true);
  });

  it("create_task (low risk) never requires confirmation", () => {
    expect(wouldRequireConfirmation("create_task", undefined)).toBe(false);
  });

  it("log_habit (low risk) never requires confirmation", () => {
    expect(wouldRequireConfirmation("log_habit", undefined)).toBe(false);
  });

  it("complete_task without confirmed:true requires confirmation", () => {
    expect(wouldRequireConfirmation("complete_task", undefined)).toBe(true);
  });

  it("update_project without confirmed:true requires confirmation", () => {
    expect(wouldRequireConfirmation("update_project", undefined)).toBe(true);
  });
});
