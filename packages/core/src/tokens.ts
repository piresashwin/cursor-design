import type { Doc, Token } from "./types";

export function isTokenRef(v: unknown): v is `$${string}` {
  return typeof v === "string" && v.startsWith("$");
}

/** Resolve a value that may be a "$token" reference. Returns the raw value for non-refs. */
export function resolve<T = unknown>(doc: Doc, value: T, mode = "light"): T | string | number {
  if (!isTokenRef(value)) return value;
  const name = value.slice(1);
  const t = doc.tokens[name];
  if (!t) return value;
  return tokenValue(t, mode) as T;
}

export function tokenValue(t: Token, mode = "light"): string | number | object {
  switch (t.type) {
    case "color":
      return mode !== "light" && t.modes?.[mode] ? t.modes[mode] : t.value;
    case "number":
    case "string":
      return t.value;
    case "font":
      return { family: t.family, size: t.size, weight: t.weight, lineHeight: t.lineHeight, letterSpacing: t.letterSpacing };
    case "shadow":
      return t.value;
  }
}

/** Every node/prop that references a token name. */
export function tokenUsages(doc: Doc, name: string): { nodeId: string; prop: string }[] {
  const ref = `$${name}`;
  const out: { nodeId: string; prop: string }[] = [];
  for (const [id, node] of Object.entries(doc.nodes)) {
    for (const [k, v] of Object.entries(node)) {
      if (v === ref) out.push({ nodeId: id, prop: k });
      else if (v && typeof v === "object" && !Array.isArray(v)) {
        for (const [k2, v2] of Object.entries(v as Record<string, unknown>)) {
          if (v2 === ref) out.push({ nodeId: id, prop: `${k}.${k2}` });
        }
      }
    }
  }
  return out;
}
