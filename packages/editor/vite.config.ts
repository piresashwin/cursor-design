import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Single JS + single CSS with fixed names so the extension can reference them with asWebviewUri.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    modulePreload: { polyfill: false },
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        entryFileNames: "editor.js",
        assetFileNames: "editor.[ext]",
      },
    },
  },
});
