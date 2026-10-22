import type { Doc, TextNode, Token } from "@cursor-design/core";

const GENERIC = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-sans-serif",
  "ui-serif",
  "ui-monospace",
  "ui-rounded",
  "emoji",
  "math",
  "fangsong",
  "inherit",
  "initial",
  "unset",
  "georgia",
  "times",
  "times new roman",
  "arial",
  "helvetica",
  "courier",
  "courier new",
  "verdana",
  "tahoma",
  "trebuchet ms",
  "comic sans ms",
  "impact",
]);

const LINK_ID = "cursor-design-fonts";

/** Primary family from a CSS font-family stack (`"Fraunces, Georgia, serif"` → `Fraunces`). */
export function primaryFamily(stack: string): string | null {
  const first = stack.split(",")[0]?.trim().replace(/^["']|["']$/g, "");
  if (!first || GENERIC.has(first.toLowerCase())) return null;
  return first;
}

/** Unique non-generic families declared by font tokens and text nodes. */
export function collectFontFamilies(doc: Doc): string[] {
  const out = new Set<string>();
  for (const t of Object.values(doc.tokens) as Token[]) {
    if (t.type === "font") {
      const f = primaryFamily(t.family);
      if (f) out.add(f);
    }
  }
  for (const n of Object.values(doc.nodes)) {
    if (n?.type !== "text") continue;
    const font = (n as TextNode).font;
    if (font && typeof font === "object" && font.family) {
      const f = primaryFamily(font.family);
      if (f) out.add(f);
    }
  }
  return [...out].sort();
}

function googleFontsHref(families: string[]): string {
  // weights 400–700 cover UI + display; display=swap avoids FOIT in the webview
  const spec = families
    .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;500;600;700`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${spec}&display=swap`;
}

/** Inject / update a single Google Fonts stylesheet for the document's families. */
export function ensureDocFonts(doc: Doc): void {
  if (typeof document === "undefined") return;
  const families = collectFontFamilies(doc);
  const existing = document.getElementById(LINK_ID) as HTMLLinkElement | null;
  if (!families.length) {
    existing?.remove();
    return;
  }
  const href = googleFontsHref(families);
  if (existing) {
    if (existing.getAttribute("href") !== href) existing.setAttribute("href", href);
    return;
  }
  const link = document.createElement("link");
  link.id = LINK_ID;
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}
