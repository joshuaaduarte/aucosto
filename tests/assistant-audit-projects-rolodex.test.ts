import { describe, expect, it, vi, beforeEach } from "vitest";
import { ACTION_REGISTRY } from "@/lib/assistant-actions";
import { ACTION_INPUT_SCHEMAS } from "@/lib/assistant-action-executor";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const PROJECTS = [
  { id: "p-dash", name: "Dash" },
  { id: "p-split", name: "Split-Flap Display" },
  { id: "p-dash2", name: "Dashboard Revamp" },
];

function mockProjects(projects = PROJECTS, impact = { projectTaskCount: 2, doItemCount: 3, timeEntryCount: 5 }) {
  vi.doMock("@/lib/services/projects", () => ({
    listBoardProjects: vi.fn().mockResolvedValue(projects),
    getProjectDeleteImpact: vi.fn().mockResolvedValue(impact),
    updateProject: vi.fn().mockImplementation((_u: string, id: string, patch: Record<string, unknown>) => {
      const p = projects.find((x) => x.id === id);
      if (!p) return null;
      return { id: p.id, name: p.name, ...patch };
    }),
    createBoardProject: vi.fn().mockResolvedValue("p-new"),
    deleteProject: vi.fn().mockResolvedValue(undefined),
  }));
}

function mockPlanning(plan: Record<string, unknown> | null = null) {
  vi.doMock("@/lib/services/project-planning", () => ({
    getProjectPlan: vi.fn().mockResolvedValue(plan),
    updateProjectPlan: vi.fn().mockResolvedValue(undefined),
    addProjectQuestion: vi.fn().mockResolvedValue(undefined),
    addProjectBlocker: vi.fn().mockResolvedValue(undefined),
  }));
}

type PersonSummary = { id: string; displayName: string };

function mockRolodex(persons: PersonSummary[] = [], detail: Record<string, unknown> | null = null) {
  vi.doMock("@/lib/services/rolodex", () => ({
    findPersonByName: vi.fn().mockImplementation((_u: string, name: string) => {
      const lower = name.toLowerCase();
      return Promise.resolve(
        persons.filter((p) => p.displayName.toLowerCase().includes(lower)),
      );
    }),
    createPerson: vi.fn().mockResolvedValue("person-new"),
    updatePerson: vi.fn().mockResolvedValue(undefined),
    addInteraction: vi.fn().mockResolvedValue("interaction-new"),
    getPerson: vi.fn().mockResolvedValue(detail),
  }));
}

async function executor() {
  return await import("@/lib/assistant-action-executor");
}

beforeEach(() => {
  vi.resetModules();
});

// ── update_project ─────────────────────────────────────────────────────────

describe("update_project", () => {
  it("accepts an explicit projectId", async () => {
    mockProjects();
    const { previewAction } = await executor();
    const r = await previewAction("user-1", "update_project", {
      projectId: "p-dash",
      status: "paused",
    });
    expect(r.ok).toBe(true);
    expect(r.previewText).toContain('"Dash"');
    expect(r.previewText).toContain("status → paused");
    expect(r.normalizedInput.projectId).toBe("p-dash");
  });

  it("rejects an unknown projectId with an actionable error", async () => {
    mockProjects();
    const { previewAction } = await executor();
    const r = await previewAction("user-1", "update_project", {
      projectId: "p-nope",
      status: "paused",
    });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('Project id "p-nope" not found');
    expect(r.error).toContain("assistant_list_projects");
  });

  it("suggests the close match instead of silently picking it", async () => {
    mockProjects();
    const { previewAction } = await executor();
    const r = await previewAction("user-1", "update_project", {
      projectName: "split",
      status: "paused",
    });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('did you mean "Split-Flap Display"');
    expect(r.candidates).toHaveLength(1);
  });

  it("exact match wins over a longer partial match", async () => {
    mockProjects();
    const { previewAction } = await executor();
    const r = await previewAction("user-1", "update_project", {
      projectName: "dash",
      status: "paused",
    });
    expect(r.ok).toBe(true);
    expect(r.normalizedInput.projectId).toBe("p-dash");
  });

  it("ambiguous name errors with candidates", async () => {
    mockProjects();
    const { previewAction } = await executor();
    const r = await previewAction("user-1", "update_project", {
      projectName: "dashb",
      status: "paused",
    });
    // "dashb" is a partial of "Dashboard Revamp" only — sanity check single suggestion
    expect(r.ok).toBe(false);
    expect(r.error).toContain("did you mean");
  });

  it("requires projectName or projectId with an actionable message", async () => {
    mockProjects();
    const { previewAction } = await executor();
    const r = await previewAction("user-1", "update_project", { status: "paused" });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("projectName");
    expect(r.error).toContain("projectId");
  });

  it("errors when no changes are specified", async () => {
    mockProjects();
    const { previewAction } = await executor();
    const r = await previewAction("user-1", "update_project", { projectName: "Dash" });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("No changes specified");
  });

  it("execute re-runs validation and calls the service", async () => {
    mockProjects();
    const { executeAction } = await executor();
    const bad = await executeAction("user-1", "update_project", {
      projectName: "Dash",
      status: "bogus",
    });
    expect(bad.ok).toBe(false);
    expect(bad.error).toContain("status");

    const good = await executeAction("user-1", "update_project", {
      projectName: "Dash",
      status: "done",
    });
    expect(good.ok).toBe(true);
    expect(good.summary).toContain("Dash");
  });
});

// ── create_project ─────────────────────────────────────────────────────────

describe("create_project", () => {
  it("rejects an invalid status with the valid values listed", async () => {
    mockProjects();
    const { previewAction } = await executor();
    const r = await previewAction("user-1", "create_project", {
      name: "New Thing",
      status: "in-progress",
    });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("exploring");
    expect(r.error).toContain("final_push");
  });

  it("rejects an invalid energyType with the valid values listed", async () => {
    mockProjects();
    const { previewAction } = await executor();
    const r = await previewAction("user-1", "create_project", {
      name: "New Thing",
      energyType: "hyper",
    });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("deep");
    expect(r.error).toContain("creative");
  });

  it("warns when a project with the same name already exists", async () => {
    mockProjects();
    const { previewAction } = await executor();
    const r = await previewAction("user-1", "create_project", { name: "dash" });
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.includes("already exists"))).toBe(true);
  });

  it("names the missing field on invalid input", async () => {
    mockProjects();
    const { previewAction } = await executor();
    const r = await previewAction("user-1", "create_project", {});
    expect(r.ok).toBe(false);
    expect(r.error).toContain("Invalid input");
    expect(r.error).toContain('"name"');
  });
});

// ── delete_project ─────────────────────────────────────────────────────────

describe("delete_project", () => {
  it("preview shows the blast radius with counts", async () => {
    mockProjects();
    const { previewAction } = await executor();
    const r = await previewAction("user-1", "delete_project", {
      projectName: "Dash",
    });
    expect(r.ok).toBe(true);
    expect(r.previewText).toContain('Delete project "Dash"');
    expect(r.previewText).toContain("Blast radius:");
    expect(r.previewText).toContain("2 project tasks will be permanently deleted");
    expect(r.previewText).toContain("3 to-do items will be kept but unlinked");
    expect(r.previewText).toContain("5 time entries will be kept but unlinked");
    expect(r.warnings.some((w) => w.includes("cannot be undone"))).toBe(true);
  });

  it("deleteTasks=true shows to-do items will also be deleted", async () => {
    mockProjects();
    const { previewAction } = await executor();
    const r = await previewAction("user-1", "delete_project", {
      projectName: "Dash",
      deleteTasks: true,
    });
    expect(r.ok).toBe(true);
    expect(r.previewText).toContain("3 to-do items will also be deleted");
  });

  it("close name suggests instead of deleting the wrong project", async () => {
    mockProjects();
    const { previewAction } = await executor();
    const r = await previewAction("user-1", "delete_project", {
      projectName: "split",
    });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('did you mean "Split-Flap Display"');
  });
});

// ── project planning actions ───────────────────────────────────────────────

describe("project planning actions", () => {
  it("update_project_plan accepts projectId", async () => {
    mockProjects();
    mockPlanning();
    const { previewAction } = await executor();
    const r = await previewAction("user-1", "update_project_plan", {
      projectId: "p-split",
      goal: "Build it",
    });
    expect(r.ok).toBe(true);
    expect(r.previewText).toContain('"Split-Flap Display"');
    expect(r.normalizedInput.projectId).toBe("p-split");
  });

  it("add_project_milestone shows the previous milestone", async () => {
    mockProjects();
    mockPlanning({ nextMilestone: "Prototype v1" });
    const { previewAction } = await executor();
    const r = await previewAction("user-1", "add_project_milestone", {
      projectName: "Dash",
      milestone: "Prototype v2",
    });
    expect(r.ok).toBe(true);
    expect(r.previewText).toContain('(was: "Prototype v1")');
  });

  it("add_project_question warns on duplicates", async () => {
    mockProjects();
    mockPlanning({ openQuestions: ["What scope?"], blockers: [] });
    const { previewAction } = await executor();
    const r = await previewAction("user-1", "add_project_question", {
      projectName: "Dash",
      question: "what scope?",
    });
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.includes("already on"))).toBe(true);
  });

  it("add_project_blocker warns on duplicates", async () => {
    mockProjects();
    mockPlanning({ openQuestions: [], blockers: ["Waiting on parts"] });
    const { previewAction } = await executor();
    const r = await previewAction("user-1", "add_project_blocker", {
      projectName: "Dash",
      blocker: "waiting on parts",
    });
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.includes("already on"))).toBe(true);
  });

  it("set_project_next_action resolves by projectId too", async () => {
    mockProjects();
    mockPlanning({ nextAction: "Old action" });
    const { previewAction } = await executor();
    const r = await previewAction("user-1", "set_project_next_action", {
      projectId: "p-dash",
      nextAction: "New action",
    });
    expect(r.ok).toBe(true);
    expect(r.previewText).toContain('(was: "Old action")');
  });

  it("planning actions reject a missing project ref actionably", async () => {
    mockProjects();
    mockPlanning();
    const { previewAction } = await executor();
    const r = await previewAction("user-1", "add_project_question", {
      question: "What?",
    });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("projectName");
    expect(r.error).toContain("projectId");
  });
});

// ── rolodex actions ────────────────────────────────────────────────────────

describe("create_rolodex_person", () => {
  it("warns when a contact with the same name already exists", async () => {
    mockRolodex([{ id: "per-1", displayName: "Ana" }]);
    const { previewAction } = await executor();
    const r = await previewAction("user-1", "create_rolodex_person", {
      displayName: "ana",
    });
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.includes("already exists"))).toBe(true);
    expect(r.warnings.some((w) => w.includes("update_rolodex_person"))).toBe(true);
  });

  it("rejects a malformed birthday with the expected format", async () => {
    mockRolodex();
    const { previewAction } = await executor();
    const r = await previewAction("user-1", "create_rolodex_person", {
      displayName: "Bob",
      birthday: "May 5th",
    });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("YYYY-MM-DD");
  });

  it("rejects an impossible birthday date", async () => {
    mockRolodex();
    const { previewAction } = await executor();
    const r = await previewAction("user-1", "create_rolodex_person", {
      displayName: "Bob",
      birthday: "2026-13-40",
    });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("not a real calendar date");
  });
});

describe("rolodex name resolution", () => {
  it("suggests the close contact instead of silently picking", async () => {
    mockRolodex([{ id: "per-1", displayName: "Troy Stenquist" }]);
    const { previewAction } = await executor();
    const r = await previewAction("user-1", "update_rolodex_person", {
      personName: "troy",
      notes: "hi",
    });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('did you mean "Troy Stenquist"');
  });

  it("no match suggests creating the contact", async () => {
    mockRolodex([]);
    const { previewAction } = await executor();
    const r = await previewAction("user-1", "add_gift_idea", {
      personName: "Nobody",
      idea: "Book",
    });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("create_rolodex_person");
  });

  it("ambiguous contacts list candidates", async () => {
    mockRolodex([
      { id: "per-1", displayName: "Ana Rivera" },
      { id: "per-2", displayName: "Ana Torres" },
    ]);
    const { previewAction } = await executor();
    const r = await previewAction("user-1", "add_person_followup", {
      personName: "ana",
      title: "Call",
    });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("Ambiguous contact match");
    expect(r.candidates).toHaveLength(2);
  });

  it("add_gift_idea warns on duplicate ideas", async () => {
    mockRolodex([{ id: "per-1", displayName: "Ana" }], { giftIdeas: ["Book"] });
    const { previewAction } = await executor();
    const r = await previewAction("user-1", "add_gift_idea", {
      personName: "Ana",
      idea: "book",
    });
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.includes("already saved"))).toBe(true);
  });

  it("add_rolodex_interaction rejects a bad followUpDate", async () => {
    mockRolodex([{ id: "per-1", displayName: "Ana" }]);
    const { previewAction } = await executor();
    const r = await previewAction("user-1", "add_rolodex_interaction", {
      personName: "Ana",
      title: "Coffee",
      followUpNeeded: true,
      followUpDate: "next Friday",
    });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("YYYY-MM-DD");
  });

  it("add_person_followup rejects a bad followUpDate", async () => {
    mockRolodex([{ id: "per-1", displayName: "Ana" }]);
    const { previewAction } = await executor();
    const r = await previewAction("user-1", "add_person_followup", {
      personName: "Ana",
      title: "Call",
      followUpDate: "tomorrow",
    });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("YYYY-MM-DD");
  });

  it("update_rolodex_person errors when no changes are specified", async () => {
    mockRolodex([{ id: "per-1", displayName: "Ana" }]);
    const { previewAction } = await executor();
    const r = await previewAction("user-1", "update_rolodex_person", {
      personName: "Ana",
    });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("No changes specified");
  });
});

// ── risk / confirmation parity for the audited actions ─────────────────────

describe("audited action risk gates", () => {
  const medium = [
    "update_project",
    "delete_project",
    "update_project_plan",
    "update_rolodex_person",
  ];
  const low = [
    "create_project",
    "add_project_milestone",
    "add_project_question",
    "add_project_blocker",
    "set_project_next_action",
    "create_rolodex_person",
    "add_rolodex_interaction",
    "add_person_followup",
    "add_gift_idea",
  ];

  it("medium-risk audited actions require confirmation", () => {
    for (const action of medium) {
      const def = ACTION_REGISTRY[action]!;
      expect(def.risk).toBe("medium");
      expect(def.confirmationRequired).toBe(true);
    }
  });

  it("low-risk audited actions do not require confirmation", () => {
    for (const action of low) {
      const def = ACTION_REGISTRY[action]!;
      expect(def.risk).toBe("low");
      expect(def.confirmationRequired).toBe(false);
    }
  });

  it("every registry action has an input schema", () => {
    for (const action of Object.keys(ACTION_REGISTRY)) {
      if (action === "finance_write") continue;
      expect(
        ACTION_INPUT_SCHEMAS[action],
        `${action} should have an input schema`,
      ).toBeDefined();
    }
  });
});

// ── finance_write stays rejected ───────────────────────────────────────────

describe("finance_write", () => {
  it("is high-risk and unsupported in the registry", () => {
    const def = ACTION_REGISTRY["finance_write"]!;
    expect(def.risk).toBe("high");
    expect(def.supported).toBe(false);
    expect(def.confirmationRequired).toBe(true);
  });

  it("has no input schema, so preview and execute reject it", async () => {
    expect(ACTION_INPUT_SCHEMAS["finance_write"]).toBeUndefined();
    const { previewAction, executeAction } = await executor();
    const preview = await previewAction("user-1", "finance_write", {});
    expect(preview.ok).toBe(false);
    const executed = await executeAction("user-1", "finance_write", {});
    expect(executed.ok).toBe(false);
  });
});
