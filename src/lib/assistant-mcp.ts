// Minimal MCP server for the assistant (external agent) API surface.
//
// Stateless Streamable HTTP: JSON-RPC 2.0 over POST (mounted at
// /api/assistant/mcp). No SSE streams, no sessions — every request is
// self-contained and authenticated via resolveAssistantAuth.
//
// Tools 1:1 wrap the existing assistant surface:
//   - assistant_snapshot / assistant_capabilities — read getters
//   - assistant_preview_action / assistant_execute_action — the executor's
//     two-step write flow (same risk gating and audit trail as the REST routes)
//   - assistant_list_tasks / assistant_list_habits / assistant_list_projects /
//     assistant_list_calendar — the read-gap list endpoints
//   - assistant_action_history — audit trail read
//
// The pure parts (tool catalog, JSON-RPC dispatch for initialize/list/ping)
// are exported for unit tests; only tools/call touches the database.

import "server-only";

import { z } from "zod";

import {
  ACTION_REGISTRY,
  type ActionDef,
} from "@/lib/assistant-actions";
import {
  ACTION_INPUT_SCHEMAS,
  executeAction,
  previewAction,
} from "@/lib/assistant-action-executor";
import { recordAudit } from "@/lib/services/assistant-audit";
import { getRecentAudits } from "@/lib/services/assistant-audit";
import { buildAssistantSnapshot } from "@/lib/assistant-snapshot";
import {
  calendarQuerySchema,
  fetchAssistantCalendar,
  fetchAssistantHabits,
  fetchAssistantPeopleTime,
  fetchAssistantPlannedVsActual,
  fetchAssistantProjects,
  fetchAssistantTasks,
  habitsQuerySchema,
  peopleTimeQuerySchema,
  plannedVsActualQuerySchema,
  tasksQuerySchema,
} from "@/lib/assistant-lists";

export const MCP_PROTOCOL_VERSION = "2025-06-18";
const SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26"];
export const MCP_SERVER_NAME = "aucosto-assistant";
export const MCP_SERVER_VERSION = "0.1.0";

// ── Tool catalog ────────────────────────────────────────────────────────────

export interface McpToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/** Summarize a JSON Schema object into "field* (type), field? (type)". Pure. */
export function summarizeJsonSchema(
  jsonSchema: Record<string, unknown>,
): string {
  const properties = (jsonSchema.properties ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  const required = new Set((jsonSchema.required ?? []) as string[]);
  return Object.entries(properties)
    .map(([name, prop]) => {
      const type =
        typeof prop.type === "string" ? prop.type : "value";
      return `${name}${required.has(name) ? "*" : "?"} (${type})`;
    })
    .join(", ");
}

/** One-line input shape per supported action, derived from the executor's
 *  zod schemas — the same contracts the REST preview/execute endpoints use. */
function actionInputShapeLines(): string[] {
  return Object.keys(ACTION_INPUT_SCHEMAS)
    .filter((action) => ACTION_REGISTRY[action]?.supported)
    .map((action) => {
      const schema = ACTION_INPUT_SCHEMAS[action]!;
      const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
      return `- ${action} (${ACTION_REGISTRY[action]!.risk} risk): { ${summarizeJsonSchema(jsonSchema)} }`;
    });
}

const tasksToolInput = z.object({
  includeDone: z.boolean().optional().describe("Include completed tasks"),
  limit: z.number().int().min(1).max(200).optional(),
});
const habitsToolInput = z.object({
  includeArchived: z.boolean().optional().describe("Include archived habits"),
});
const calendarToolInput = z.object({
  from: z
    .string()
    .optional()
    .describe("ISO datetime with offset; defaults to now"),
  to: z
    .string()
    .optional()
    .describe("ISO datetime with offset; defaults to from + 7 days"),
});
const peopleTimeToolInput = z.object({
  from: z
    .string()
    .optional()
    .describe("ISO datetime with offset; defaults to 7 days ago"),
  to: z
    .string()
    .optional()
    .describe("ISO datetime with offset; defaults to now"),
});
const plannedVsActualToolInput = z.object({
  date: z
    .string()
    .optional()
    .describe("YYYY-MM-DD; defaults to today (server-local)"),
});
const historyToolInput = z.object({
  limit: z.number().int().min(1).max(100).optional(),
});
const previewToolInput = z.object({
  action: z
    .enum(Object.keys(ACTION_INPUT_SCHEMAS) as [string, ...string[]])
    .describe("Action name from assistant_capabilities"),
  input: z.record(z.string(), z.unknown()).describe("Action input"),
  source: z
    .object({ actor: z.string().optional() })
    .passthrough()
    .optional()
    .describe("Attribution for the audit trail"),
});
const executeToolInput = previewToolInput.extend({
  confirmed: z
    .boolean()
    .optional()
    .describe("Required true for medium-risk actions"),
});

const toJsonSchema = (schema: z.ZodTypeAny): Record<string, unknown> =>
  z.toJSONSchema(schema) as Record<string, unknown>;

export function buildToolCatalog(): McpToolDef[] {
  const shapeLines = actionInputShapeLines().join("\n");
  return [
    {
      name: "assistant_snapshot",
      description:
        "Read the full assistant context snapshot: today's/week's calendar, time, tasks, habits, projects, finance summary, signals, and briefing.",
      inputSchema: toJsonSchema(z.object({})),
    },
    {
      name: "assistant_capabilities",
      description:
        "List the action registry with risk levels, confirmation requirements, and descriptions.",
      inputSchema: toJsonSchema(z.object({})),
    },
    {
      name: "assistant_preview_action",
      description: `Validate and preview a write action WITHOUT mutating. Returns human-readable preview text, normalized input, and warnings. Always preview before executing.\n\nInput shapes per action (* = required):\n${shapeLines}`,
      inputSchema: toJsonSchema(previewToolInput),
    },
    {
      name: "assistant_execute_action",
      description: `Execute a write action. Medium-risk actions require confirmed: true. High-risk actions are rejected. Every call is audited.\n\nInput shapes per action (* = required):\n${shapeLines}`,
      inputSchema: toJsonSchema(executeToolInput),
    },
    {
      name: "assistant_list_tasks",
      description:
        "List tasks/do items with IDs (needed for complete_task/update_task, which require taskId).",
      inputSchema: toJsonSchema(tasksToolInput),
    },
    {
      name: "assistant_list_habits",
      description: "List habits with IDs, streaks, and today's completion state.",
      inputSchema: toJsonSchema(habitsToolInput),
    },
    {
      name: "assistant_list_projects",
      description:
        "List projects with IDs, status, open task counts, and next actions.",
      inputSchema: toJsonSchema(z.object({})),
    },
    {
      name: "assistant_list_calendar",
      description:
        "List calendar blocks in a date range (max 90 days, defaults to the next 7 days).",
      inputSchema: toJsonSchema(calendarToolInput),
    },
    {
      name: "assistant_list_people_time",
      description:
        "Per-person time totals for a date range (max 90 days, defaults to the last 7 days): minutes with each Rolodex person, broken down by category. Answers 'who am I spending time with?'",
      inputSchema: toJsonSchema(peopleTimeToolInput),
    },
    {
      name: "assistant_list_planned_vs_actual",
      description:
        "Planned vs actual for one calendar day (defaults to today): each block with its planned window, linked time entries, duration delta, and start-time drift. Answers 'did I do what I planned?'",
      inputSchema: toJsonSchema(plannedVsActualToolInput),
    },
    {
      name: "assistant_action_history",
      description: "Read recent assistant action audit rows.",
      inputSchema: toJsonSchema(historyToolInput),
    },
  ];
}

// ── tools/call handlers ─────────────────────────────────────────────────────

type ToolArgs = Record<string, unknown>;

function toolText(data: unknown) {
  return [{ type: "text", text: JSON.stringify(data) }];
}

function toolError(message: string) {
  return {
    content: [{ type: "text", text: message }],
    isError: true as const,
  };
}

function resolveActor(source: unknown): string {
  if (typeof source === "object" && source !== null && "actor" in source) {
    const actor = (source as Record<string, unknown>).actor;
    if (typeof actor === "string" && actor) return actor;
  }
  return "mcp";
}

async function callPreviewAction(userId: string, args: ToolArgs) {
  const parsed = previewToolInput.safeParse(args);
  if (!parsed.success) return toolError(`Invalid arguments: ${parsed.error.message}`);
  const { action, input, source } = parsed.data;

  const def: ActionDef | undefined = ACTION_REGISTRY[action];
  if (!def) return toolError(`Unknown action: ${action}`);
  if (!def.supported) return toolError(`Action "${action}" is not supported`);

  const preview = await previewAction(userId, action, input);
  await recordAudit({
    userId,
    action,
    actor: resolveActor(source),
    riskLevel: def.risk,
    confirmed: false,
    status: "previewed",
    source: (source ?? null) as Record<string, unknown> | null,
    normalizedInput: preview.ok ? preview.normalizedInput : input,
    previewText: preview.previewText,
    resultRecordId: null,
    resultRecordType: null,
    beforeState: null,
  });

  if (!preview.ok) {
    return toolError(
      `Preview failed: ${preview.error}${preview.candidates?.length ? `\nCandidates: ${JSON.stringify(preview.candidates)}` : ""}`,
    );
  }
  return {
    content: toolText({
      ok: true,
      action,
      risk: def.risk,
      requiresConfirmation: def.confirmationRequired,
      previewText: preview.previewText,
      normalizedInput: preview.normalizedInput,
      warnings: preview.warnings,
    }),
  };
}

async function callExecuteAction(userId: string, args: ToolArgs) {
  const parsed = executeToolInput.safeParse(args);
  if (!parsed.success) return toolError(`Invalid arguments: ${parsed.error.message}`);
  const { action, input, confirmed, source } = parsed.data;

  const def: ActionDef | undefined = ACTION_REGISTRY[action];
  if (!def) return toolError(`Unknown action: ${action}`);
  if (!def.supported) return toolError(`Action "${action}" is not supported`);
  if (def.risk === "high") {
    return toolError(`High-risk action "${action}" requires manual execution`);
  }
  if (def.confirmationRequired && confirmed !== true) {
    return toolError(
      `Confirmation required for this action — re-call with confirmed: true`,
    );
  }

  const result = await executeAction(userId, action, input);
  await recordAudit({
    userId,
    action,
    actor: resolveActor(source),
    riskLevel: def.risk,
    confirmed: confirmed === true,
    status: result.ok ? "executed" : "rejected",
    source: (source ?? null) as Record<string, unknown> | null,
    normalizedInput: input,
    previewText: result.summary,
    resultRecordId: result.recordId,
    resultRecordType: result.recordType,
    beforeState: null,
  });

  if (!result.ok) return toolError(`Execution failed: ${result.error}`);
  return {
    content: toolText({
      ok: true,
      action,
      summary: result.summary,
      recordId: result.recordId,
      recordType: result.recordType,
    }),
  };
}

async function callTool(
  userId: string,
  name: string,
  args: ToolArgs,
): Promise<{ content: { type: string; text: string }[]; isError?: true }> {
  switch (name) {
    case "assistant_snapshot":
      return { content: toolText(await buildAssistantSnapshot(userId)) };
    case "assistant_capabilities":
      return {
        content: toolText({
          version: 1,
          generatedAt: new Date().toISOString(),
          actions: Object.fromEntries(
            Object.entries(ACTION_REGISTRY).map(([key, def]) => [
              key,
              {
                risk: def.risk,
                confirmationRequired: def.confirmationRequired,
                supported: def.supported,
                description: def.description,
              },
            ]),
          ),
        }),
      };
    case "assistant_preview_action":
      return callPreviewAction(userId, args);
    case "assistant_execute_action":
      return callExecuteAction(userId, args);
    case "assistant_list_tasks": {
      const parsed = tasksQuerySchema.safeParse({
        includeDone: args.includeDone ?? false,
        limit: args.limit ?? 100,
      });
      if (!parsed.success) return toolError(`Invalid arguments: ${parsed.error.message}`);
      return { content: toolText(await fetchAssistantTasks(userId, parsed.data)) };
    }
    case "assistant_list_habits": {
      const parsed = habitsQuerySchema.safeParse({
        includeArchived: args.includeArchived ?? false,
      });
      if (!parsed.success) return toolError(`Invalid arguments: ${parsed.error.message}`);
      return { content: toolText(await fetchAssistantHabits(userId, parsed.data)) };
    }
    case "assistant_list_projects":
      return { content: toolText(await fetchAssistantProjects(userId)) };
    case "assistant_list_calendar": {
      const parsed = calendarQuerySchema.safeParse({
        from: args.from,
        to: args.to,
      });
      if (!parsed.success) return toolError(`Invalid arguments: ${parsed.error.message}`);
      return { content: toolText(await fetchAssistantCalendar(userId, parsed.data)) };
    }
    case "assistant_list_people_time": {
      const parsed = peopleTimeQuerySchema.safeParse({
        from: args.from,
        to: args.to,
      });
      if (!parsed.success) return toolError(`Invalid arguments: ${parsed.error.message}`);
      return { content: toolText(await fetchAssistantPeopleTime(userId, parsed.data)) };
    }
    case "assistant_list_planned_vs_actual": {
      const parsed = plannedVsActualQuerySchema.safeParse({
        date: args.date,
      });
      if (!parsed.success) return toolError(`Invalid arguments: ${parsed.error.message}`);
      return { content: toolText(await fetchAssistantPlannedVsActual(userId, parsed.data)) };
    }
    case "assistant_action_history": {
      const parsed = historyToolInput.safeParse(args);
      if (!parsed.success) return toolError(`Invalid arguments: ${parsed.error.message}`);
      const limit = parsed.data.limit ?? 20;
      try {
        const audits = await getRecentAudits(userId, limit);
        return { content: toolText({ audits, count: audits.length }) };
      } catch (error) {
        console.error("[assistant/mcp] failed to fetch audits", error);
        return { content: toolText({ audits: [], count: 0 }) };
      }
    }
    default:
      return toolError(`Unknown tool: ${name}`);
  }
}

// ── JSON-RPC dispatch (pure protocol layer) ─────────────────────────────────

interface JsonRpcRequest {
  jsonrpc?: unknown;
  id?: unknown;
  method?: unknown;
  params?: unknown;
}

export interface McpDispatchResult {
  status: number; // 200 JSON-RPC response, 202 notification accepted
  body: unknown; // null when status is 202
}

function rpcError(id: unknown, code: number, message: string) {
  return {
    status: 200,
    body: { jsonrpc: "2.0", id: id ?? null, error: { code, message } },
  } satisfies McpDispatchResult;
}

function rpcResult(id: unknown, result: unknown) {
  return {
    status: 200,
    body: { jsonrpc: "2.0", id: id ?? null, result },
  } satisfies McpDispatchResult;
}

async function dispatchOne(
  userId: string,
  req: JsonRpcRequest,
): Promise<McpDispatchResult> {
  if (
    typeof req !== "object" ||
    req === null ||
    req.jsonrpc !== "2.0" ||
    typeof req.method !== "string"
  ) {
    return rpcError(req?.id, -32600, "Invalid Request");
  }

  const isNotification = req.id === undefined || req.id === null;

  switch (req.method) {
    case "initialize": {
      const params = (req.params ?? {}) as Record<string, unknown>;
      const requested = params.protocolVersion;
      const protocolVersion =
        typeof requested === "string" &&
        SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
          ? requested
          : MCP_PROTOCOL_VERSION;
      return rpcResult(req.id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
      });
    }
    case "ping":
      return rpcResult(req.id, {});
    case "tools/list":
      return rpcResult(req.id, { tools: buildToolCatalog() });
    case "tools/call": {
      const params = (req.params ?? {}) as Record<string, unknown>;
      const name = params.name;
      if (typeof name !== "string" || !name) {
        return rpcError(req.id, -32602, "Invalid params: name is required");
      }
      const args =
        typeof params.arguments === "object" && params.arguments !== null
          ? (params.arguments as ToolArgs)
          : {};
      const result = await callTool(userId, name, args);
      return rpcResult(req.id, result);
    }
    default:
      if (req.method.startsWith("notifications/")) {
        // Fire-and-forget notifications (e.g. notifications/initialized).
        return { status: 202, body: null };
      }
      if (isNotification) {
        return { status: 202, body: null };
      }
      return rpcError(req.id, -32601, `Method not found: ${req.method}`);
  }
}

/**
 * Handle a JSON-RPC 2.0 request (single or batch) for an authenticated user.
 * Pure protocol layer — only tools/call reaches the database.
 */
export async function handleMcpRequest(
  userId: string,
  body: unknown,
): Promise<McpDispatchResult> {
  if (body === null || typeof body !== "object") {
    return rpcError(null, -32700, "Parse error: body must be a JSON object");
  }
  if (Array.isArray(body)) {
    if (body.length === 0) {
      return rpcError(null, -32600, "Invalid Request: empty batch");
    }
    const results = await Promise.all(
      body.map((item) => dispatchOne(userId, item as JsonRpcRequest)),
    );
    const responses = results
      .filter((r) => r.status === 200)
      .map((r) => r.body);
    if (responses.length === 0) return { status: 202, body: null };
    return { status: 200, body: responses };
  }
  return dispatchOne(userId, body as JsonRpcRequest);
}
