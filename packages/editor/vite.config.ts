import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

// index.html → editor.js (webview + standalone tests)
// preview.html → preview.js (localhost browser host)
// Shared CSS as editor.css.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    modulePreload: { polyfill: false },
    cssCodeSplit: false,
    rollupOptions: {
      input: {
        main: path.join(root, "index.html"),
        preview: path.join(root, "preview.html"),
      },
      output: {
        entryFileNames: (chunk) => (chunk.name === "preview" ? "preview.js" : "editor.js"),
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: (info) => {
          if (info.name && info.name.endsWith(".css")) return "editor.css";
          return "assets/[name][extname]";
        },
      },
    },
  },
});
