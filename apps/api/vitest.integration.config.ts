import { defineConfig } from "vitest/config";

/** Runs against the Postgres from docker-compose. Invoke with `pnpm test:integration`. */
export default defineConfig({
  test: {
    include: ["test/integration/**/*.test.ts"],
    setupFiles: ["reflect-metadata"],
    fileParallelism: false,
    testTimeout: 20_000,
  },
  esbuild: {
    tsconfigRaw: { compilerOptions: { experimentalDecorators: true } },
  },
});
