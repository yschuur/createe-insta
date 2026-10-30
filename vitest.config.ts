import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  test: { exclude: ["tests/browser/**", "node_modules/**"] },
});
