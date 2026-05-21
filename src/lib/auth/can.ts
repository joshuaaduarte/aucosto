// Tool-scoped authorization. Service-layer functions call requireCan() at the
// top of every operation; that is the single chokepoint where "is this user
// allowed to do this" gets answered. Callers (server actions, server
// components, future agent endpoints) pass the session userId they already
// authenticated, never a value pulled from form data or query string.
//
// V1 (single user, Josh): any authenticated userId gets everything. The point
// of the abstraction is that adding partner-with-finance-read-only later is a
// single edit here, not a sweep across every route.

export type Tool = "time" | "finance" | "calendar" | "events";
export type Action = "read" | "write";

export function can(
  userId: string | null | undefined,
  _tool: Tool,
  _action: Action,
): boolean {
  return Boolean(userId);
}

export class AuthorizationError extends Error {
  constructor(
    public readonly tool: Tool,
    public readonly action: Action,
  ) {
    super(`Not authorized: ${action} on ${tool}`);
    this.name = "AuthorizationError";
  }
}

export function requireCan(
  userId: string | null | undefined,
  tool: Tool,
  action: Action,
): asserts userId is string {
  if (!can(userId, tool, action)) {
    throw new AuthorizationError(tool, action);
  }
}
