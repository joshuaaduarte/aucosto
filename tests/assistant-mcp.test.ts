import { describe, expect, it } from "vitest";
import {
  buildToolCatalog,
  handleMcpRequest,
  MCP_PROTOCOL_VERSION,
  MCP_SERVER_NAME,
  summarizeJsonSchema,
} from "@/lib/assistant-mcp";

const USER_ID = "test-user";

// ── summarizeJsonSchema ─────────────────────────────────────────────────────

describe("summarizeJsonSchema", () => {
  it("marks required fields with * and optional with ?", () => {
    const summary = summarizeJsonSchema({
      type: "object",
      properties: {
        title: { type: "string" },
        notes: { type: "string" },
        limit: { type: "number" },
      },
      required: ["title"],
    });
    expect(summary).toBe("title* (string), notes? (string), limit? (number)");
  });

  it("handles schemas without properties", () => {
    expect(summarizeJsonSchema({ type: "object" })).toBe("");
  });
});

// ── buildToolCatalog ────────────────────────────────────────────────────────

describe("buildToolCatalog", () => {
  const tools = buildToolCatalog();

  it("exposes ten tools", () => {
    expect(tools).toHaveLength(10);
  });

  it("has unique names", () => {
    const names = tools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("gives every tool a name, description, and inputSchema", () => {
    for (const tool of tools) {
      expect(tool.name.length).toBeGreaterThan(0);
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.inputSchema).toMatchObject({ type: "object" });
    }
  });

  it("includes the expected tool names", () => {
    const names = tools.map((t) => t.name);
    expect(names).toEqual([
      "assistant_snapshot",
      "assistant_capabilities",
      "assistant_preview_action",
      "assistant_execute_action",
      "assistant_list_tasks",
      "assistant_list_habits",
      "assistant_list_projects",
      "assistant_list_calendar",
      "assistant_list_people_time",
      "assistant_action_history",
    ]);
  });

  it("embeds per-action input shapes in the preview tool description", () => {
    const preview = tools.find((t) => t.name === "assistant_preview_action")!;
    expect(preview.description).toContain("create_task");
    expect(preview.description).toContain("title* (string)");
  });
});

// ── handleMcpRequest: protocol layer (no DB touched) ────────────────────────

describe("handleMcpRequest", () => {
  it("answers initialize with protocol negotiation and server info", async () => {
    const { status, body } = await handleMcpRequest(USER_ID, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: {} },
    });
    expect(status).toBe(200);
    expect(body).toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: {
        protocolVersion: "2025-06-18",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: MCP_SERVER_NAME },
      },
    });
  });

  it("falls back to our protocol version for unknown client versions", async () => {
    const { body } = await handleMcpRequest(USER_ID, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "1999-01-01" },
    });
    expect((body as { result: { protocolVersion: string } }).result.protocolVersion).toBe(
      MCP_PROTOCOL_VERSION,
    );
  });

  it("answers ping", async () => {
    const { status, body } = await handleMcpRequest(USER_ID, {
      jsonrpc: "2.0",
      id: 2,
      method: "ping",
    });
    expect(status).toBe(200);
    expect(body).toMatchObject({ jsonrpc: "2.0", id: 2, result: {} });
  });

  it("lists tools", async () => {
    const { status, body } = await handleMcpRequest(USER_ID, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/list",
    });
    expect(status).toBe(200);
    const tools = (body as { result: { tools: unknown[] } }).result.tools;
    expect(tools).toHaveLength(10);
  });

  it("accepts notifications without a response body", async () => {
    const { status, body } = await handleMcpRequest(USER_ID, {
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });
    expect(status).toBe(202);
    expect(body).toBeNull();
  });

  it("returns -32601 for unknown methods", async () => {
    const { status, body } = await handleMcpRequest(USER_ID, {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/delete",
    });
    expect(status).toBe(200);
    expect(body).toMatchObject({
      jsonrpc: "2.0",
      id: 4,
      error: { code: -32601 },
    });
  });

  it("returns -32600 for malformed envelopes", async () => {
    const { body } = await handleMcpRequest(USER_ID, {
      jsonrpc: "1.0",
      id: 5,
      method: "ping",
    });
    expect(body).toMatchObject({ error: { code: -32600 } });
  });

  it("returns -32700 for non-object bodies", async () => {
    const { body } = await handleMcpRequest(USER_ID, "not-json");
    expect(body).toMatchObject({ error: { code: -32700 } });
  });

  it("returns -32602 when tools/call lacks a name", async () => {
    const { body } = await handleMcpRequest(USER_ID, {
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: { arguments: {} },
    });
    expect(body).toMatchObject({ error: { code: -32602 } });
  });

  it("reports unknown tools as tool errors (not protocol errors)", async () => {
    const { status, body } = await handleMcpRequest(USER_ID, {
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: { name: "assistant_nonexistent", arguments: {} },
    });
    expect(status).toBe(200);
    const result = (body as { result: { isError: boolean; content: { text: string }[] } })
      .result;
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("Unknown tool");
  });

  it("handles batch requests", async () => {
    const { status, body } = await handleMcpRequest(USER_ID, [
      { jsonrpc: "2.0", id: 1, method: "ping" },
      { jsonrpc: "2.0", id: 2, method: "tools/list" },
    ]);
    expect(status).toBe(200);
    expect(body).toHaveLength(2);
  });

  it("returns 202 for all-notification batches", async () => {
    const { status, body } = await handleMcpRequest(USER_ID, [
      { jsonrpc: "2.0", method: "notifications/initialized" },
    ]);
    expect(status).toBe(202);
    expect(body).toBeNull();
  });
});
