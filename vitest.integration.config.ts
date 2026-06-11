// Config for DB-backed integration tests (tests/integration/). Kept separate
// from vitest.config.ts so `npm test` stays fast and offline; run these with
// `npm run test:integration` (requires .env with a reachable DATABASE_URL —
// the dev DB, never prod).
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      // Services import "server-only", which throws outside RSC. Stub it.
      "server-only": fileURLToPath(
        new URL("./tests/integration/server-only-stub.ts", import.meta.url),
      ),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    setupFiles: ["tests/integration/setup.ts"],
    // DB-backed tests share state; run files serially.
    fileParallelism: false,
  },
});
