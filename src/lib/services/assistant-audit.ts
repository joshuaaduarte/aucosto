import "server-only";
import { prisma } from "@/lib/prisma";

export interface AssistantActionAudit {
  id: string;
  userId: string;
  action: string;
  actor: string;
  riskLevel: string;
  confirmed: boolean;
  status: string; // "previewed" | "executed" | "rejected"
  source: {
    channel?: string;
    conversationId?: string;
    userText?: string;
  } | null;
  normalizedInput: Record<string, unknown>;
  previewText: string;
  resultRecordId: string | null;
  resultRecordType: string | null;
  beforeState: Record<string, unknown> | null;
  createdAt: string; // ISO
}

let auditTableReady: Promise<void> | null = null;

export function ensureAuditTable(): Promise<void> {
  if (!auditTableReady) {
    auditTableReady = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS assistant_action_audits (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          user_id TEXT NOT NULL,
          action TEXT NOT NULL,
          actor TEXT NOT NULL DEFAULT 'assistant',
          risk_level TEXT NOT NULL DEFAULT 'low',
          confirmed BOOLEAN NOT NULL DEFAULT false,
          status TEXT NOT NULL DEFAULT 'previewed',
          source JSONB,
          normalized_input JSONB NOT NULL DEFAULT '{}',
          preview_text TEXT NOT NULL DEFAULT '',
          result_record_id TEXT,
          result_record_type TEXT,
          before_state JSONB,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_aaa_user_created
        ON assistant_action_audits(user_id, created_at DESC)
      `);
    })()
      .then(() => undefined)
      .catch((error) => {
        auditTableReady = null;
        console.error("[assistant-audit] ensureAuditTable failed", error);
      });
  }
  return auditTableReady!;
}

export async function recordAudit(
  entry: Omit<AssistantActionAudit, "id" | "createdAt">,
): Promise<string> {
  await ensureAuditTable();
  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO assistant_action_audits
       (user_id, action, actor, risk_level, confirmed, status, source,
        normalized_input, preview_text, result_record_id, result_record_type, before_state)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11,$12::jsonb)
     RETURNING id`,
    entry.userId,
    entry.action,
    entry.actor,
    entry.riskLevel,
    entry.confirmed,
    entry.status,
    JSON.stringify(entry.source ?? null),
    JSON.stringify(entry.normalizedInput),
    entry.previewText,
    entry.resultRecordId ?? null,
    entry.resultRecordType ?? null,
    JSON.stringify(entry.beforeState ?? null),
  );
  return rows[0]?.id ?? "";
}

export async function getRecentAudits(
  userId: string,
  limit = 20,
): Promise<AssistantActionAudit[]> {
  await ensureAuditTable();
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT id, user_id, action, actor, risk_level, confirmed, status,
            source, normalized_input, preview_text, result_record_id,
            result_record_type, before_state, created_at
     FROM assistant_action_audits
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    userId,
    limit,
  );
  return rows.map((r) => ({
    id: String(r.id),
    userId: String(r.user_id),
    action: String(r.action),
    actor: String(r.actor),
    riskLevel: String(r.risk_level),
    confirmed: Boolean(r.confirmed),
    status: String(r.status),
    source: (r.source ?? null) as AssistantActionAudit["source"],
    normalizedInput: (r.normalized_input ?? {}) as Record<string, unknown>,
    previewText: String(r.preview_text),
    resultRecordId: r.result_record_id ? String(r.result_record_id) : null,
    resultRecordType: r.result_record_type ? String(r.result_record_type) : null,
    beforeState: (r.before_state ?? null) as Record<string, unknown> | null,
    createdAt:
      r.created_at instanceof Date
        ? r.created_at.toISOString()
        : String(r.created_at),
  }));
}
