import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    environmentOptions: { jsdom: { url: "https://x.com/home" } },
    restoreMocks: true,
    include: ["tests/**/*.test.ts"],
  },
});
