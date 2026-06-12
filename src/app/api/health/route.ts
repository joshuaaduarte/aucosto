// Deployment health probe: which build is live, and does the DB answer.
// No auth (exposes nothing sensitive — a commit sha and two booleans);
// used to diagnose "is production actually running the latest deploy?".

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  let db = false;
  let reflectTable = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = true;
    const rows = await prisma.$queryRaw<Array<{ n: number }>>`
      SELECT count(*)::int AS n FROM information_schema.tables
      WHERE table_name = 'DailyReflection'
    `;
    reflectTable = (rows[0]?.n ?? 0) > 0;
  } catch {
    // db stays false
  }

  return NextResponse.json({
    ok: db,
    sha:
      process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
      process.env.VERCEL_GIT_COMMIT_REF ??
      "unknown",
    db,
    reflectTable,
    at: new Date().toISOString(),
  });
}
