// MCP endpoint for the assistant (external agent) API surface.
// Stateless Streamable HTTP: JSON-RPC 2.0 over POST. No SSE streams or
// sessions — every request is authenticated independently via the shared
// assistant auth (session cookie or ASSISTANT_API_SECRET bearer token).
//
//   curl -X POST https://<host>/api/assistant/mcp \
//     -H "Authorization: Bearer $ASSISTANT_API_SECRET" \
//     -H "Content-Type: application/json" \
//     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

import { resolveAssistantAuth } from "@/lib/assistant-auth";
import { handleMcpRequest } from "@/lib/assistant-mcp";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const authed = await resolveAssistantAuth(req);
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
      { status: 200 },
    );
  }

  const { status, body: responseBody } = await handleMcpRequest(
    authed.userId,
    body,
  );
  if (status === 202 || responseBody === null) {
    return new NextResponse(null, { status: 202 });
  }
  return NextResponse.json(responseBody, { status });
}

function methodNotAllowed() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST with a JSON-RPC 2.0 body." },
    { status: 405, headers: { Allow: "POST" } },
  );
}

export async function GET() {
  return methodNotAllowed();
}

export async function DELETE() {
  return methodNotAllowed();
}
