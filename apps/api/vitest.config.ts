import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    setupFiles: ["reflect-metadata"],
  },
  esbuild: {
    tsconfigRaw: { compilerOptions: { experimentalDecorators: true } },
  },
});
