import type { Node } from "./types";

/** Role prefixes for machine ids (snake_case after the prefix). */
export const ID_PREFIX: Record<string, string> = {
  frame: "fr",
  rect: "rc",
  ellipse: "el",
  text: "tx",
  image: "im",
  icon: "ic",
  chart: "ch",
  shape: "sh",
  avatar: "av",
  progress: "pr",
  skeleton: "sk",
  instance: "ix",
  component: "cp",
  page: "pg",
  folder: "fd",
  annotation: "an",
};

/** Names that are never acceptable as a human-facing layer name. */
const GENERIC_NAMES = new Set([
  "",
  "frame",
  "text",
  "rect",
  "ellipse",
  "image",
  "icon",
  "chart",
  "shape",
  "avatar",
  "progress",
  "skeleton",
  "instance",
  "component",
  "node",
]);

const ID_PREFIX_RE = /^(fr|tx|bt|ic|in|ix|cp|sp|an|pg|fd|rc|el|im|ch|sh|av|pr|sk|img|row|col|card|nav|btn)_/i;

export function isGenericName(name: string | undefined | null): boolean {
  if (name == null) return true;
  return GENERIC_NAMES.has(name.trim().toLowerCase());
}

/** `auth_logo_row` → `Logo row`; `fr_home` → `Home`. */
export function humanizeId(id: string): string {
  const bare = id.replace(ID_PREFIX_RE, "").replace(/[_-]+/g, " ").trim();
  if (!bare) return "";
  return bare
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/**
 * Derive a Title Case display name for a node when `name` is missing or generic.
 * Icons keep Lucide glyph ids in `name` — do not overwrite those.
 */
export function defaultDisplayName(node: Pick<Node, "id" | "type" | "name"> & Record<string, unknown>): string {
  if (node.type === "icon") {
    const glyph = typeof node.name === "string" ? node.name : "icon";
    return `Icon · ${glyph}`;
  }
  if (!isGenericName(node.name)) return node.name as string;

  if (node.type === "text") {
    const content = typeof node.content === "string" ? node.content.trim() : "";
    if (content && !isGenericName(content)) {
      return content.length > 40 ? `${content.slice(0, 37)}…` : content;
    }
  }
  if (node.type === "chart") {
    const chart = node.chart as { kind?: string } | undefined;
    return `${capitalize(chart?.kind ?? "Chart")} chart`;
  }
  if (node.type === "shape") {
    return capitalize(typeof node.kind === "string" ? node.kind : "Shape");
  }
  if (node.type === "avatar") {
    const initials = typeof node.initials === "string" ? node.initials : "";
    return initials ? `Avatar · ${initials}` : "Avatar";
  }
  if (node.type === "progress") {
    const kind = typeof node.kind === "string" ? node.kind : "progress";
    return `${capitalize(kind)} progress`;
  }
  if (node.type === "skeleton") {
    const kind = typeof node.kind === "string" ? node.kind : "skeleton";
    return `${capitalize(kind)} skeleton`;
  }
  if (node.type === "instance") {
    const fromId = humanizeId(node.id);
    return fromId || "Instance";
  }

  const fromId = humanizeId(node.id);
  if (fromId) return fromId;
  return capitalize(node.type);
}

/**
 * Ensure `node.name` is a usable display name (mutates).
 * Icons: `name` is the Lucide glyph — leave unchanged.
 */
export function ensureNodeName(node: Node): void {
  if (node.type === "icon") return;
  if (!isGenericName(node.name)) return;
  (node as { name?: string }).name = defaultDisplayName(node);
}

/** Label for the pages tree / inspector — never falls back to bare `"frame"`. */
export function nodeDisplayLabel(node: Node | undefined, id: string): string {
  if (!node) return humanizeId(id) || id;
  if (node.type === "icon") {
    return `Icon · ${node.name || "icon"}`;
  }
  if (!isGenericName(node.name)) return node.name as string;
  return defaultDisplayName(node);
}
