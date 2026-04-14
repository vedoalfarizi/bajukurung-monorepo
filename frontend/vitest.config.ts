import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json"],
    },
  },
  resolve: {
    alias: {
      "@baju-kurung/shared": resolve(__dirname, "../shared/types.ts"),
    },
  },
});
