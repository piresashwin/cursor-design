// Generates packages/core/src/icons.ts from a curated lucide-react subset.
// Run: node scripts/gen-icons.mjs [path-to-lucide-react/dist/esm/icons]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const ICONS_DIR =
  process.argv[2] ?? "/Users/ashwin/dev/daily-bread-app/node_modules/lucide-react/dist/esm/icons";

const NAMES = [
  "house", "user", "users", "search", "bell", "settings", "check", "x", "plus", "minus",
  "trash-2", "pencil", "heart", "star", "calendar", "mail", "chevron-right", "chevron-down",
  "chevron-left", "chevron-up", "arrow-right", "arrow-left", "arrow-up", "arrow-down", "menu",
  "lock", "eye", "eye-off", "download", "upload", "share-2", "filter", "ellipsis", "circle-check",
  "circle-alert", "info", "clock", "map-pin", "credit-card", "shopping-cart", "chart-column",
  "chart-line", "chart-pie", "trending-up", "external-link", "link", "image", "play", "pause",
  "zap", "sun", "moon", "wifi", "phone", "message-circle", "folder", "file", "file-text", "bookmark",
  // common chrome (nav / media / actions)
  "trophy", "mic", "send", "thumbs-up", "thumbs-down", "copy", "arrow-up-right", "volume-2",
];
const ALIASES = {
  home: "house",
  "bar-chart": "chart-column",
  "line-chart": "chart-line",
  "pie-chart": "chart-pie",
  trash: "trash-2",
  edit: "pencil",
  close: "x",
  more: "ellipsis",
  warning: "circle-alert",
  funnel: "filter",
  cart: "shopping-cart",
  microphone: "mic",
  volume: "volume-2",
};

const strip = (attrs) => {
  const { key, ...rest } = attrs; // drop React key
  return rest;
};

/** Parse createLucideIcon("Name", [ ... ]) icon nodes from lucide ESM source. */
function parseIconNode(src, file) {
  const m = src.match(/createLucideIcon\([^,]+,\s*(\[[\s\S]*\])\s*\)/);
  if (!m) throw new Error(`no createLucideIcon array in ${file}`);
  // eslint-disable-next-line no-new-func
  const node = new Function(`return (${m[1]})`)();
  if (!Array.isArray(node)) throw new Error(`icon node is not an array in ${file}`);
  return node;
}

const out = {};
for (const name of NAMES) {
  const base = path.join(ICONS_DIR, name);
  const file = existsSync(`${base}.mjs`) ? `${base}.mjs` : `${base}.js`;
  if (!existsSync(file)) throw new Error(`missing icon file ${file}`);
  const node = parseIconNode(readFileSync(file, "utf8"), file);
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
