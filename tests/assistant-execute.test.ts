import { beforeEach, describe, expect, it, vi } from "vitest";

// The shared execute gate used by both the REST route and the MCP tool.
// Executor and audit are mocked so only the gating + audit wiring is tested.

const executeAction = vi.fn();
const recordAudit = vi.fn().mockResolvedValue("audit-1");

vi.mock("@/lib/assistant-action-executor", () => ({ executeAction }));
vi.mock("@/lib/services/assistant-audit", () => ({ recordAudit }));
vi.mock("@/lib/assistant-actions", () => ({
  ACTION_REGISTRY: {
    low_one: { risk: "low", confirmationRequired: false, supported: true },
    medium_one: { risk: "medium", confirmationRequired: true, supported: true },
    high_one: { risk: "high", confirmationRequired: true, supported: true },
    off_one: { risk: "low", confirmationRequired: false, supported: false },
  },
}));

const { executeGatedAction, resolveActor } = await import("@/lib/assistant-execute");

const base = { input: {}, defaultActor: "assistant" };

beforeEach(() => {
  executeAction.mockReset();
  recordAudit.mockClear();
});

describe("executeGatedAction", () => {
  it("refuses unknown, unsupported, and high-risk actions without executing", async () => {
    for (const [action, refused] of [
      ["nope", "unknown"],
      ["off_one", "unsupported"],
      ["high_one", "high_risk"],
    ] as const) {
      const out = await executeGatedAction("u", { ...base, action, confirmed: true });
      expect(out.ok).toBe(false);
      expect(!out.ok && out.refused).toBe(refused);
    }
    expect(executeAction).not.toHaveBeenCalled();
    expect(recordAudit).not.toHaveBeenCalled();
  });

  it("requires confirmed: true for medium-risk actions", async () => {
    const out = await executeGatedAction("u", { ...base, action: "medium_one" });
    expect(!out.ok && out.refused).toBe("needs_confirmation");
    expect(executeAction).not.toHaveBeenCalled();
  });

  it("executes and audits a confirmed action", async () => {
    executeAction.mockResolvedValue({
      ok: true,
      recordId: "r1",
      recordType: "doItem",
      summary: "done",
    });
    const out = await executeGatedAction("u", {
      ...base,
      action: "medium_one",
      confirmed: true,
      source: { actor: "claude" },
    });
    expect(out.ok).toBe(true);
    expect(out.ok && out.auditId).toBe("audit-1");
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ actor: "claude", status: "executed", confirmed: true }),
    );
  });

  it("audits a rejected execution", async () => {
    executeAction.mockResolvedValue({
      ok: false,
      error: "bad",
      recordId: null,
      recordType: null,
      summary: "",
    });
    const out = await executeGatedAction("u", { ...base, action: "low_one" });
    expect(out.ok).toBe(false);
    expect(!out.ok && out.auditId).toBe("audit-1");
    expect(recordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ actor: "assistant", status: "rejected" }),
    );
  });
});

describe("resolveActor", () => {
  it("uses source.actor when present, else the fallback", () => {
    expect(resolveActor({ actor: "x" }, "mcp")).toBe("x");
    expect(resolveActor({ actor: "" }, "mcp")).toBe("mcp");
    expect(resolveActor(null, "mcp")).toBe("mcp");
  });
});
