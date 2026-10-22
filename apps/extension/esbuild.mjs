import { build, context } from "esbuild";
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes("--watch");

// copy the built webview bundle next to the extension
const editorDist = path.join(here, "../../packages/editor/dist");
const media = path.join(here, "media");
if (existsSync(editorDist)) {
  mkdirSync(media, { recursive: true });
  cpSync(editorDist, media, { recursive: true });
} else {
  console.warn("[esbuild] packages/editor/dist not found — build the editor first");
}

/** @type {import('esbuild').BuildOptions} */
const opts = {
  entryPoints: [path.join(here, "src/extension.ts")],
  bundle: true,
  outfile: path.join(here, "dist/extension.js"),
  platform: "node",
  target: "node20",
  format: "cjs",
  external: ["vscode"],
  sourcemap: true,
  logLevel: "info",
};

if (watch) {
  const ctx = await context(opts);
  await ctx.watch();
} else {
  await build(opts);
}
