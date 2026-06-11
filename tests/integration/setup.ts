// Integration tests hit the real dev DB, so they need .env (DATABASE_URL)
// loaded before any module imports @/lib/prisma. Vitest runs this setup file
// before the test module is evaluated.
import { existsSync } from "node:fs";

if (existsSync(".env")) {
  process.loadEnvFile(".env");
}
