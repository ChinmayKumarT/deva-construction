import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";

// Unit tests for the pure money-math helpers (lib/wages.ts, lib/cashflow.ts).
// The `@/` alias mirrors tsconfig so the modules resolve the same way they do
// under Next. cashflow.ts imports the supabase server client as a *type only*,
// so nothing pulls in next/headers at test time.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
