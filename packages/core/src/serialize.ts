import type { Doc } from "./types";
import { DocSchema } from "./schema";

const TOP_ORDER = ["schemaVersion", "name", "tokens", "folderRoot", "folders", "pages", "nodes", "components", "annotations", "timelines"];
const NODE_ORDER = [
  "id", "type", "name", "visible", "x", "y", "width", "height", "layout", "clip", "overflow",
  "fill", "stroke", "radius", "shadow", "opacity", "zIndex", "backdropBlur", "blur", "mixBlendMode",
  "mask", "clipPath", "outline", "transform",
  "content", "font", "align", "decoration", "textTransform",
  "src", "fit", "strokeWidth", "chart", "kind", "sides", "innerRatio", "direction", "seed", "complexity",
  "initials", "size", "textFill", "ring", "value", "max", "barFill", "label", "lines", "animated",
  "link", "preset", "children",
];

/** Alphabetically sort keys of plain objects (recursively) for stable nested JSON. */
function deepSortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(deepSortKeys);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as object).sort()) {
      out[k] = deepSortKeys((v as Record<string, unknown>)[k]);
    }
    return out;
  }
  return v;
}

function orderKeys(obj: Record<string, unknown>, order: string[]) {
  const out: Record<string, unknown> = {};
  for (const k of order) if (k in obj) out[k] = deepSortKeys(obj[k]);
  for (const k of Object.keys(obj).sort()) if (!(k in out)) out[k] = deepSortKeys(obj[k]);
  return out;
}

function sortedMap<T>(map: Record<string, T>, mapEntry?: (v: T) => unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const id of Object.keys(map).sort()) out[id] = mapEntry ? mapEntry(map[id]) : deepSortKeys(map[id]);
  return out;
}

/** Stable, git-friendly serialization: fixed key order, sorted id maps, 2-space indent, trailing newline. */
export function serialize(doc: Doc): string {
  const d = orderKeys(doc as unknown as Record<string, unknown>, TOP_ORDER);
  d.tokens = sortedMap(doc.tokens);
  d.folders = sortedMap(doc.folders);
  d.pages = sortedMap(doc.pages);
  d.nodes = sortedMap(doc.nodes, (n) => orderKeys(n as unknown as Record<string, unknown>, NODE_ORDER));
  if (doc.annotations) d.annotations = sortedMap(doc.annotations);
  if (doc.timelines) d.timelines = sortedMap(doc.timelines);
  return JSON.stringify(d, null, 2) + "\n";
}

export type ParseResult = { ok: true; doc: Doc } | { ok: false; error: string };

export function parse(text: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: `invalid JSON: ${(e as Error).message}` };
  }
  const r = DocSchema.safeParse(json);
  if (!r.success) return { ok: false, error: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n") };
  return { ok: true, doc: r.data as Doc };
}

export function validate(doc: unknown): string[] {
  const r = DocSchema.safeParse(doc);
  if (r.success) {
    // referential integrity
    const d = r.data as Doc;
    const errs: string[] = [];
    for (const [id, f] of Object.entries(d.folders))
      for (const c of f.children) if (!d.folders[c] && !d.pages[c]) errs.push(`folder ${id} references unknown ${c}`);
    for (const [id, p] of Object.entries(d.pages))
      for (const f of p.frames) {
        if (!d.nodes[f]) errs.push(`page ${id} references unknown frame ${f}`);
        else if (d.nodes[f].type !== "frame") errs.push(`page ${id} frame ${f} is not a frame`);
      }
    for (const [id, n] of Object.entries(d.nodes))
      if (n.type === "frame") for (const c of n.children) if (!d.nodes[c]) errs.push(`frame ${id} references unknown child ${c}`);
    if (d.timelines) {
      for (const [id, tl] of Object.entries(d.timelines)) {
        if (tl.id !== id) errs.push(`timeline ${id} id mismatch`);
        const frame = d.nodes[tl.frameId];
        if (!frame || frame.type !== "frame") errs.push(`timeline ${id} frameId ${tl.frameId} is not a frame`);
        else {
          const { nodeParent } = (() => {
            const nodeParent: Record<string, string> = {};
            for (const [nid, n] of Object.entries(d.nodes)) {
              if (n.type === "frame") for (const c of n.children) nodeParent[c] = nid;
            }
            return { nodeParent };
          })();
          for (const track of tl.tracks) {
            if (!d.nodes[track.nodeId]) {
              errs.push(`timeline ${id} unknown node ${track.nodeId}`);
              continue;
            }
            let cur: string | undefined = track.nodeId;
            let under = track.nodeId === tl.frameId;
            while (cur && !under) {
              if (cur === tl.frameId) under = true;
              cur = nodeParent[cur];
            }
            if (!under) errs.push(`timeline ${id} node ${track.nodeId} not under frame ${tl.frameId}`);
          }
        }
      }
    }
    return errs;
  }
  return r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
}
