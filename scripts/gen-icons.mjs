// Generates packages/core/src/icons.ts from a curated lucide-react subset.
// Run: node scripts/gen-icons.mjs [path-to-lucide-react/dist/esm/icons]
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const ICONS_DIR =
  process.argv[2] ?? "/Users/ashwin/dev/daily-bread-app/node_modules/lucide-react/dist/esm/icons";

const NAMES = [
  "house", "user", "users", "search", "bell", "settings", "check", "x", "plus", "minus",
  "trash-2", "pencil", "heart", "star", "calendar", "mail", "chevron-right", "chevron-down",
  "chevron-left", "chevron-up", "arrow-right", "arrow-left", "arrow-up", "arrow-down", "menu",
  "lock", "eye", "eye-off", "download", "upload", "share-2", "funnel", "ellipsis", "circle-check",
  "circle-alert", "info", "clock", "map-pin", "credit-card", "shopping-cart", "chart-column",
  "chart-line", "chart-pie", "trending-up", "external-link", "link", "image", "play", "pause",
  "zap", "sun", "moon", "wifi", "phone", "message-circle", "folder", "file", "file-text", "bookmark",
];
const ALIASES = { home: "house", "bar-chart": "chart-column", "line-chart": "chart-line", "pie-chart": "chart-pie", trash: "trash-2", edit: "pencil", close: "x", more: "ellipsis", warning: "circle-alert", filter: "funnel", cart: "shopping-cart" };

const strip = (attrs) => {
  const { key, ...rest } = attrs; // drop React key
  return rest;
};

const out = {};
for (const name of NAMES) {
  const mod = await import(path.join(ICONS_DIR, `${name}.mjs`));
  const node = mod.__iconNode;
  if (!Array.isArray(node)) throw new Error(`no __iconNode for ${name}`);
  out[name] = node.map(([tag, attrs]) => [tag, strip(attrs)]);
}
for (const [alias, target] of Object.entries(ALIASES)) if (out[target]) out[alias] = out[target];

const sorted = Object.keys(out).sort().reduce((o, k) => ((o[k] = out[k]), o), {});
const body = `// AUTO-GENERATED from lucide-react v1.39.0 (ISC License). Do not edit by hand.
// Regenerate with: node scripts/gen-icons.mjs
// Curated subset rendered as inline SVG (24x24 viewBox, stroke-based) by the editor.

export type IconElement = [tag: string, attrs: Record<string, string | number>];

export const ICONS: Record<string, IconElement[]> = ${JSON.stringify(sorted, null, 2)};

export const ICON_NAMES: string[] = Object.keys(ICONS);
export function hasIcon(name: string): boolean { return name in ICONS; }
`;
const dest = path.join(here, "../packages/core/src/icons.ts");
writeFileSync(dest, body);
console.log(`wrote ${dest} with ${Object.keys(sorted).length} icons (incl. aliases)`);
