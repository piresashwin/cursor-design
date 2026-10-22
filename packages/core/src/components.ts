import type {
  ComponentDef,
  ComponentPropDef,
  Doc,
  FrameNode,
  Id,
  InstanceNode,
  Node,
} from "./types";

const INSTANCE_SHELL_KEYS = new Set([
  "id",
  "type",
  "name",
  "component",
  "props",
  "overrides",
  "visible",
  "x",
  "y",
  "width",
  "height",
  "opacity",
  "zIndex",
  "link",
  "transform",
]);

/** Remap master id → instance-scoped id. */
export function instanceNodeId(instanceId: Id, masterId: Id): Id {
  return `${instanceId}::${masterId}`;
}

export function parseInstanceNodeId(id: Id): { instanceId: Id; masterId: Id } | null {
  const i = id.indexOf("::");
  if (i <= 0) return null;
  return { instanceId: id.slice(0, i), masterId: id.slice(i + 2) };
}

export function componentUsages(doc: Doc, componentId: Id): Id[] {
  return Object.keys(doc.nodes).filter((id) => {
    const n = doc.nodes[id];
    return n?.type === "instance" && (n as InstanceNode).component === componentId;
  });
}

function collectMasterSubtree(doc: Doc, id: Id, out: Id[]) {
  out.push(id);
  const n = doc.nodes[id];
  if (n?.type === "frame") for (const c of n.children) collectMasterSubtree(doc, c, out);
}

function setField(target: Record<string, unknown>, fieldPath: string, value: unknown) {
  const parts = fieldPath.split(".");
  let cur: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!cur[p] || typeof cur[p] !== "object") cur[p] = {};
    cur = cur[p] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

function mergeOverride(node: Node, override: Record<string, unknown> | undefined): Node {
  if (!override) return node;
  const out = { ...node } as Record<string, unknown>;
  for (const [k, v] of Object.entries(override)) {
    if (k === "id" || k === "type" || k === "children") continue;
    out[k] = v;
  }
  return out as unknown as Node;
}

export type ExpandedInstance = {
  rootId: Id;
  nodes: Record<Id, Node>;
};

/**
 * Expand an instance into a virtual node tree (not written to the doc).
 * Master ids are remapped to `instanceId::masterId` so React keys stay stable per instance.
 */
export function expandInstance(doc: Doc, instance: InstanceNode, depth = 0): ExpandedInstance | null {
  if (depth > 8) return null;
  const def = doc.components?.[instance.component];
  if (!def) return null;
  const masterRoot = doc.nodes[def.root];
  if (!masterRoot || masterRoot.type !== "frame") return null;

  const masterIds: Id[] = [];
  collectMasterSubtree(doc, def.root, masterIds);

  const idMap = new Map<Id, Id>();
  for (const mid of masterIds) idMap.set(mid, instanceNodeId(instance.id, mid));

  const nodes: Record<Id, Node> = {};
  for (const mid of masterIds) {
    const src = doc.nodes[mid];
    if (!src) continue;
    const clone = structuredClone(src) as Node;
    (clone as { id: Id }).id = idMap.get(mid)!;
    if (clone.type === "frame") {
      (clone as FrameNode).children = (clone as FrameNode).children.map((c) => idMap.get(c) ?? c);
    }
    nodes[clone.id] = clone;
  }

  const rootId = idMap.get(def.root)!;
  const propValues: Record<string, string | number | boolean> = {};
  for (const [key, spec] of Object.entries(def.props ?? {})) {
    const v = instance.props?.[key] ?? spec.default;
    if (v !== undefined) propValues[key] = v as string | number | boolean;
  }

  // Variant overrides (root-only shorthand or per-master-id map)
  const variantKey = def.variantProp ?? "variant";
  const variantName = String(propValues[variantKey] ?? "");
  const variantOverrides = def.variants?.[variantName];
  if (variantOverrides) {
    for (const [target, ov] of Object.entries(variantOverrides)) {
      const masterTarget = target === "" || target === def.root ? def.root : target;
      const mapped = idMap.get(masterTarget);
      if (!mapped || !nodes[mapped]) continue;
      nodes[mapped] = mergeOverride(nodes[mapped], ov);
    }
  }

  // Prop binds: "tx_label.content" or "tx_label" (defaults to .content)
  for (const [key, spec] of Object.entries(def.props ?? {}) as [string, ComponentPropDef][]) {
    if (!spec.bind) continue;
    const value = propValues[key];
    if (value === undefined) continue;
    const bind = spec.bind;
    const dot = bind.indexOf(".");
    const masterNodeId = dot >= 0 ? bind.slice(0, dot) : bind;
    const field = dot >= 0 ? bind.slice(dot + 1) : "content";
    const mapped = idMap.get(masterNodeId === "root" || masterNodeId === "" ? def.root : masterNodeId);
    if (!mapped || !nodes[mapped]) continue;
    setField(nodes[mapped] as unknown as Record<string, unknown>, field, value);
  }

  // Instance overrides keyed by master id
  for (const [masterId, ov] of Object.entries(instance.overrides ?? {})) {
    const mapped = idMap.get(masterId === "" || masterId === "root" ? def.root : masterId);
    if (!mapped || !nodes[mapped]) continue;
    nodes[mapped] = mergeOverride(nodes[mapped], ov);
  }

  // Instance shell props win on the expanded root (size, link, chrome)
  const root = nodes[rootId] as FrameNode;
  const shell = instance as unknown as Record<string, unknown>;
  const rootRec = root as unknown as Record<string, unknown>;
  for (const [k, v] of Object.entries(shell)) {
    if (!INSTANCE_SHELL_KEYS.has(k)) continue;
    if (k === "id" || k === "type" || k === "component" || k === "props" || k === "overrides") continue;
    if (v !== undefined) rootRec[k] = v;
  }
  // Keep expanded root id as remapped (for tree), but data-node-id for picking should be instance id on the outer wrapper — NodeView handles instance specially.
  rootRec.name = instance.name ?? def.name;
  nodes[rootId] = root;

  // Nested instances inside the master: expand recursively into the map
  for (const id of Object.keys(nodes)) {
    const n = nodes[id];
    if (n.type !== "instance") continue;
    const nested = expandInstance({ ...doc, nodes: { ...doc.nodes, ...nodes } }, n as InstanceNode, depth + 1);
    if (!nested) continue;
    Object.assign(nodes, nested.nodes);
    // replace this instance node with a pointer frame? Keep as instance — NodeView expands again.
  }

  return { rootId, nodes };
}

export function listComponents(doc: Doc): ComponentDef[] {
  return Object.values(doc.components ?? {});
}

export function getComponent(doc: Doc, id: Id): ComponentDef | undefined {
  return doc.components?.[id];
}
