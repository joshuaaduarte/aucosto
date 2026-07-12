// Apply a .sql file statement-by-statement over DIRECT_URL (session pooler —
// the transaction pooler can't run DDL). For the manual-migration fallback
// when `prisma migrate dev` is blocked by history divergence:
//
//   npx tsx --env-file=.env scripts/apply-sql.ts scripts/create-push-whoop-location.sql
//
// Statements are split on semicolons at end-of-line; keep the .sql files to
// plain DDL (no functions/procedures with embedded semicolons).

import { readFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: apply-sql.ts <file.sql>");
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DIRECT_URL / DATABASE_URL not set");

  const sql = readFileSync(file, "utf8");
  const statements = sql
    .split(/;\s*\n/)
    .map((statement) =>
      statement
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter((statement) => statement.length > 0);

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });
  try {
    for (const statement of statements) {
      console.log(`→ ${statement.split("\n")[0]} …`);
      await prisma.$executeRawUnsafe(statement);
    }
    console.log("done.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
