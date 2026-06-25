import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    // Mirror tsconfig's "@/*" -> "src/*" alias so tests can import the same way.
    alias: {
      // Services import "server-only", which throws outside RSC. Stub it.
      "server-only": fileURLToPath(
        new URL("./tests/integration/server-only-stub.ts", import.meta.url),
      ),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    // DB-backed tests live in tests/integration/ and run via
    // `npm run test:integration` (vitest.integration.config.ts).
    exclude: ["tests/integration/**", "**/node_modules/**"],
    environment: "node",
  },
});
