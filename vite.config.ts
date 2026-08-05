import { defineConfig } from "vite";
import { resolve } from "path";

// Multi-page static site: every game gets its own real HTML page under /games/<name>/
// so it can be linked to, refreshed, and deployed as plain static output — no router needed.
export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        home: resolve(__dirname, "index.html"),
        dino: resolve(__dirname, "games/dino/index.html"),
      },
    },
  },
});
