import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// The client is constructed lazily, on first property access, so importing
// this module never requires DATABASE_URL. That matters at build time:
// `next build` collects page data by importing route modules, and an eager
// throw here fails the whole build in any environment without secrets (CI,
// preview containers). The error still surfaces immediately on the first
// real query.
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
}

let cached: PrismaClient | undefined;

function getClient(): PrismaClient {
  // The dev-mode global keeps HMR from stacking connection pools; the
  // module-level cache covers production, where one module instance lives
  // for the process lifetime.
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  if (!cached) {
    cached = createClient();
    if (process.env.NODE_ENV !== "production") {
      globalForPrisma.prisma = cached;
    }
  }
  return cached;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
