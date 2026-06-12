// One-off backfill: assigns a category (via inferCategory) to every finance
// transaction that has none. Idempotent — only touches NULL categories.
//   npx tsx --env-file=.env scripts/backfill-finance-categories.ts
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { inferCategory } from "../src/lib/finance-categories";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });

  const transactions = await prisma.financeTransaction.findMany({
    where: { category: null },
  });

  let updated = 0;
  for (const tx of transactions) {
    await prisma.financeTransaction.update({
      where: { id: tx.id },
      data: { category: inferCategory(tx.description, tx.amount) },
    });
    updated += 1;
  }

  console.log(`Backfilled ${updated} finance transaction categories`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
