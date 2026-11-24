/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    coverage: {
      include: ["src/lib/**", "src/api/**", "src/state/**"],
      reporter: ["text", "html"],
      // CI runs `npm run coverage`, so dropping below these fails the build,
      // like the coverage gate on the Python services.
      thresholds: { lines: 90, statements: 85, functions: 85, branches: 75 },
    },
  },
});
