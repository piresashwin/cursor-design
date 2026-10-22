import type { ComponentDef, Doc, Folder, FrameNode, Node, Page } from "./types";
import { OpSchema, type Op } from "./schema";
import { idFor } from "./ids";
import { ensureNodeName } from "./naming";
import { componentUsages } from "./components";

export type ValidationError = { op: number; message: string };
export type ApplyResult = { doc: Doc; inverse: Op[]; changed: string[]; errors?: ValidationError[] };

/** Derived parent index — never stored in the document. */
export function indexParents(doc: Doc) {
  const nodeParent: Record<string, string> = {};
  const framePage: Record<string, string> = {};
  const pageFolder: Record<string, string | null> = {};
  const folderParent: Record<string, string | null> = {};
  for (const [id, n] of Object.entries(doc.nodes)) {
    if (n.type === "frame") for (const c of n.children) nodeParent[c] = id;
  }
  for (const [id, p] of Object.entries(doc.pages)) for (const f of p.frames) framePage[f] = id;
  for (const id of doc.folderRoot) folderParent[id] = null;
  for (const [id, f] of Object.entries(doc.folders)) {
    for (const c of f.children) {
      if (doc.pages[c]) pageFolder[c] = id;
      else folderParent[c] = id;
    }
  }
  for (const id of Object.keys(doc.pages)) if (!(id in pageFolder)) pageFolder[id] = null;
  return { nodeParent, framePage, pageFolder, folderParent };
}

function clone<T>(v: T): T {
  return structuredClone(v);
}

function insertAt<T>(arr: T[], item: T, index?: number) {
  const i = index === undefined || index < 0 || index > arr.length ? arr.length : index;
  arr.splice(i, 0, item);
  return i;
}

function removeFrom<T>(arr: T[], item: T): number {
  const i = arr.indexOf(item);
  if (i >= 0) arr.splice(i, 1);
  return i;
}

/**
 * Apply a batch of ops atomically. Returns the new doc and the inverse ops (for undo).
 * On any validation error the original doc is returned unchanged with `errors`.
 */
export function applyOps(input: Doc, ops: Op[]): ApplyResult {
  const errors: ValidationError[] = [];
  const parsed: Op[] = [];
  ops.forEach((op, i) => {
    const r = OpSchema.safeParse(op);
    if (!r.success) errors.push({ op: i, message: r.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ") });
    else parsed.push(r.data);
  });
  if (errors.length) return { doc: input, inverse: [], changed: [], errors };

  const doc = clone(input);
  const inverse: Op[] = [];
  const changed = new Set<string>();

  const fail = (i: number, message: string) => {
    errors.push({ op: i, message });
  };

  const frameOf = (i: number, id: string): FrameNode | undefined => {
    const n = doc.nodes[id];
    if (!n) fail(i, `unknown node ${id}`);
    else if (n.type !== "frame") fail(i, `${id} is not a frame`);
    else return n;
    return undefined;
  };

  const collectSubtree = (id: string, out: Set<string>) => {
    out.add(id);
    const n = doc.nodes[id];
    if (n?.type === "frame") for (const c of n.children) collectSubtree(c, out);
  };

  for (let i = 0; i < parsed.length; i++) {
    const op = parsed[i];
    const idx = indexParents(doc);
    switch (op.op) {
      case "create": {
        const parent = frameOf(i, op.parent);
        if (!parent) break;
        const node = { ...(op.node as Partial<Node>) } as Node;
        if (!node.id) (node as Node).id = idFor(node.type);
        if (doc.nodes[node.id]) {
          fail(i, `node ${node.id} already exists`);
          break;
        }
        if (node.type === "instance") {
          const cid = (node as { component?: string }).component;
          if (!cid || !doc.components?.[cid]) {
            fail(i, `instance requires an existing component (got ${cid ?? "missing"})`);
            break;
          }
        }
        if (node.type === "frame") {
          // keep only children that exist and are not already parented elsewhere (nested creation happens via later ops)
          const kids = ((node as FrameNode).children ?? []).filter((c) => doc.nodes[c] && !idx.nodeParent[c] && !idx.framePage[c]);
          (node as FrameNode).children = kids;
        }
        ensureNodeName(node);
        doc.nodes[node.id] = node;
        if (!parent.children.includes(node.id)) insertAt(parent.children, node.id, op.index);
        changed.add(node.id);
        changed.add(parent.id);
        inverse.unshift({ op: "delete", ids: [node.id] });
        break;
      }
      case "update": {
        const n = doc.nodes[op.id];
        if (!n) {
          fail(i, `unknown node ${op.id}`);
          break;
        }
        const before = clone(n) as Record<string, unknown>;
        const rec = n as unknown as Record<string, unknown>;
        for (const [k, v] of Object.entries(op.set ?? {})) {
          if (k === "id" || k === "type" || k === "children") continue;
          rec[k] = v;
        }
        for (const k of op.unset ?? []) if (k !== "id" && k !== "type" && k !== "children") delete rec[k];
        changed.add(op.id);
        const setBack: Record<string, unknown> = {};
        const unsetBack: string[] = [];
        for (const k of new Set([...Object.keys(op.set ?? {}), ...(op.unset ?? [])])) {
          if (k in before) setBack[k] = before[k];
          else unsetBack.push(k);
        }
        inverse.unshift({ op: "update", id: op.id, set: setBack, unset: unsetBack });
        break;
      }
      case "move": {
        const n = doc.nodes[op.id];
        const target = frameOf(i, op.parent);
        if (!n || !target) {
          if (!n) fail(i, `unknown node ${op.id}`);
          break;
        }
        const sub = new Set<string>();
        collectSubtree(op.id, sub);
        if (sub.has(op.parent)) {
          fail(i, `cannot move ${op.id} into its own subtree`);
          break;
        }
        const fromId = idx.nodeParent[op.id];
        const fromIndex = fromId ? removeFrom((doc.nodes[fromId] as FrameNode).children, op.id) : -1;
        if (!fromId) {
          // top-level frame being nested: detach from page
          const pg = idx.framePage[op.id];
          if (pg) removeFrom(doc.pages[pg].frames, op.id);
        }
        insertAt(target.children, op.id, op.index);
        changed.add(op.id);
        changed.add(target.id);
        if (fromId) {
          changed.add(fromId);
          inverse.unshift({ op: "move", id: op.id, parent: fromId, index: fromIndex });
        } else {
          const pg = idx.framePage[op.id];
          if (pg) inverse.unshift({ op: "moveFrame", id: op.id, page: pg });
        }
        break;
      }
      case "delete": {
        for (const id of op.ids) {
          if (!doc.nodes[id]) {
            fail(i, `unknown node ${id}`);
            continue;
          }
          // Block deleting a component master root while the component (or instances) exist.
          const asMaster = Object.values(doc.components ?? {}).find((c) => c.root === id);
          if (asMaster) {
            fail(i, `node ${id} is the master for component ${asMaster.id}; delete the component first (setComponent null)`);
            continue;
          }
          const sub = new Set<string>();
          collectSubtree(id, sub);
          const parentId = idx.nodeParent[id];
          const pageId = idx.framePage[id];
          const snapshot = [...sub].map((s) => clone(doc.nodes[s]));
          let index = -1;
          if (parentId) index = removeFrom((doc.nodes[parentId] as FrameNode).children, id);
          else if (pageId) index = removeFrom(doc.pages[pageId].frames, id);
          for (const s of sub) {
            delete doc.nodes[s];
            changed.add(s);
          }
          if (parentId) changed.add(parentId);
          // inverse: recreate the subtree top-down (DFS pre-order). Each snapshot frame is recreated with
          // empty children; descendants re-attach themselves at their original index.
          const strip = (n: Node) => (n.type === "frame" ? { ...n, children: [] } : n) as Record<string, unknown> & { type: string };
          const root = snapshot[0];
          const rest = snapshot.slice(1);
          const restore: Op[] = [];
          if (parentId) restore.push({ op: "create", node: strip(root), parent: parentId, index });
          else if (pageId) restore.push({ op: "createFrame", frame: strip(root), page: pageId, index });
          for (const r of rest) {
            const p = snapshot.find((s) => s.type === "frame" && (s as FrameNode).children.includes(r.id)) as FrameNode | undefined;
            if (p) restore.push({ op: "create", node: strip(r), parent: p.id, index: p.children.indexOf(r.id) });
          }
          inverse.unshift(...restore);
        }
        break;
      }
      case "createFrame": {
        const page = doc.pages[op.page];
        if (!page) {
          fail(i, `unknown page ${op.page}`);
          break;
        }
        const frame = { type: "frame", children: [], ...(op.frame as Partial<FrameNode>) } as FrameNode;
        if (!frame.id) frame.id = idFor("frame");
        if (doc.nodes[frame.id]) {
          fail(i, `node ${frame.id} already exists`);
          break;
        }
        ensureNodeName(frame);
        // restore descendants if present in a snapshot? (not supported; nodes must exist)
        doc.nodes[frame.id] = frame;
        insertAt(page.frames, frame.id, op.index);
        changed.add(frame.id);
        changed.add(op.page);
        inverse.unshift({ op: "delete", ids: [frame.id] });
        break;
      }
      case "moveFrame": {
        const from = idx.framePage[op.id];
        const n = doc.nodes[op.id];
        if (!n || n.type !== "frame" || !from) {
          fail(i, `${op.id} is not a top-level frame`);
          break;
        }
        if (!doc.pages[op.page]) {
          fail(i, `unknown page ${op.page}`);
          break;
        }
        const fromIndex = removeFrom(doc.pages[from].frames, op.id);
        insertAt(doc.pages[op.page].frames, op.id, op.index);
        changed.add(op.id);
        changed.add(from);
        changed.add(op.page);
        inverse.unshift({ op: "moveFrame", id: op.id, page: from, index: fromIndex });
        break;
      }
      case "createPage": {
        const id = op.id ?? idFor("page");
        if (doc.pages[id]) {
          fail(i, `page ${id} exists`);
          break;
        }
        if (op.folder && !doc.folders[op.folder]) {
          fail(i, `unknown folder ${op.folder}`);
          break;
        }
        doc.pages[id] = { name: op.name, frames: [] };
        if (op.folder) insertAt(doc.folders[op.folder].children, id, op.index);
        changed.add(id);
        inverse.unshift({ op: "deletePage", id });
        break;
      }
      case "renamePage": {
        const p = doc.pages[op.id];
        if (!p) {
          fail(i, `unknown page ${op.id}`);
          break;
        }
        inverse.unshift({ op: "renamePage", id: op.id, name: p.name });
        p.name = op.name;
        changed.add(op.id);
        break;
      }
      case "movePage": {
        if (!doc.pages[op.id]) {
          fail(i, `unknown page ${op.id}`);
          break;
        }
        if (op.folder && !doc.folders[op.folder]) {
          fail(i, `unknown folder ${op.folder}`);
          break;
        }
        const from = idx.pageFolder[op.id];
        let fromIndex: number | undefined;
        if (from) fromIndex = removeFrom(doc.folders[from].children, op.id);
        if (op.folder) insertAt(doc.folders[op.folder].children, op.id, op.index);
        changed.add(op.id);
        inverse.unshift({ op: "movePage", id: op.id, folder: from ?? null, index: fromIndex });
        break;
      }
      case "deletePage": {
        const p = doc.pages[op.id];
        if (!p) {
          fail(i, `unknown page ${op.id}`);
          break;
        }
        if (p.frames.length && !op.moveFramesTo) {
          fail(i, `page ${op.id} has ${p.frames.length} frames; pass moveFramesTo`);
          break;
        }
        if (op.moveFramesTo && !doc.pages[op.moveFramesTo]) {
          fail(i, `unknown page ${op.moveFramesTo}`);
          break;
        }
        const snapshot: Page = clone(p);
        const from = idx.pageFolder[op.id];
        if (op.moveFramesTo) {
          for (const f of p.frames) doc.pages[op.moveFramesTo].frames.push(f);
          changed.add(op.moveFramesTo);
        }
        if (from) removeFrom(doc.folders[from].children, op.id);
        delete doc.pages[op.id];
        changed.add(op.id);
        inverse.unshift({ op: "createPage", id: op.id, name: snapshot.name, folder: from ?? null });
        for (const f of snapshot.frames) inverse.push({ op: "moveFrame", id: f, page: op.id });
        break;
      }
      case "createFolder": {
        const id = op.id ?? idFor("folder");
        if (doc.folders[id]) {
          fail(i, `folder ${id} exists`);
          break;
        }
        if (op.parent && !doc.folders[op.parent]) {
          fail(i, `unknown folder ${op.parent}`);
          break;
        }
        doc.folders[id] = { name: op.name, children: [] };
        if (op.parent) insertAt(doc.folders[op.parent].children, id, op.index);
        else insertAt(doc.folderRoot, id, op.index);
        changed.add(id);
        inverse.unshift({ op: "deleteFolder", id });
        break;
      }
      case "renameFolder": {
        const f = doc.folders[op.id];
        if (!f) {
          fail(i, `unknown folder ${op.id}`);
          break;
        }
        inverse.unshift({ op: "renameFolder", id: op.id, name: f.name });
        f.name = op.name;
        changed.add(op.id);
        break;
      }
      case "moveFolder": {
        if (!doc.folders[op.id]) {
          fail(i, `unknown folder ${op.id}`);
          break;
        }
        // cycle check
        let cur: string | null | undefined = op.parent;
        let cyc = false;
        while (cur) {
          if (cur === op.id) {
            cyc = true;
            break;
          }
          cur = idx.folderParent[cur];
        }
        if (cyc) {
          fail(i, `cannot move folder ${op.id} into itself`);
          break;
        }
        const from = idx.folderParent[op.id];
        const fromIndex = from ? removeFrom(doc.folders[from].children, op.id) : removeFrom(doc.folderRoot, op.id);
        if (op.parent) insertAt(doc.folders[op.parent].children, op.id, op.index);
        else insertAt(doc.folderRoot, op.id, op.index);
        changed.add(op.id);
        inverse.unshift({ op: "moveFolder", id: op.id, parent: from ?? null, index: fromIndex });
        break;
      }
      case "deleteFolder": {
        const f = doc.folders[op.id];
        if (!f) {
          fail(i, `unknown folder ${op.id}`);
          break;
        }
        const from = idx.folderParent[op.id];
        const target = op.moveChildrenTo === undefined ? from : op.moveChildrenTo;
        const snapshot: Folder = clone(f);
        const children = [...f.children];
        if (target) {
          if (!doc.folders[target]) {
            fail(i, `unknown folder ${target}`);
            break;
          }
          doc.folders[target].children.push(...children);
        } else {
          doc.folderRoot.push(...children.filter((c) => doc.folders[c]));
          // pages moved to root level lose their folder (allowed: pageFolder = null)
        }
        if (from) removeFrom(doc.folders[from].children, op.id);
        else removeFrom(doc.folderRoot, op.id);
        delete doc.folders[op.id];
        changed.add(op.id);
        inverse.unshift({ op: "createFolder", id: op.id, name: snapshot.name, parent: from ?? null });
        for (const c of children) {
          if (doc.pages[c]) inverse.push({ op: "movePage", id: c, folder: op.id });
          else inverse.push({ op: "moveFolder", id: c, parent: op.id });
        }
        break;
      }
      case "setToken": {
        const before = doc.tokens[op.name];
        if (op.token === null) delete doc.tokens[op.name];
        else doc.tokens[op.name] = op.token;
        changed.add(`$${op.name}`);
        inverse.unshift({ op: "setToken", name: op.name, token: before ?? null });
        break;
      }
      case "upsertAnnotation": {
        doc.annotations ??= {};
        const id = op.id ?? idFor("annotation");
        const before = doc.annotations[id];
        if (!doc.nodes[op.annotation.nodeId]) {
          fail(i, `unknown node ${op.annotation.nodeId}`);
          break;
        }
        doc.annotations[id] = { createdAt: new Date().toISOString(), ...before, ...op.annotation };
        changed.add(id);
        inverse.unshift(before ? { op: "upsertAnnotation", id, annotation: before } : { op: "deleteAnnotation", ids: [id] });
        break;
      }
      case "deleteAnnotation": {
        doc.annotations ??= {};
        for (const id of op.ids) {
          const before = doc.annotations[id];
          if (!before) continue;
          delete doc.annotations[id];
          changed.add(id);
          inverse.unshift({ op: "upsertAnnotation", id, annotation: before });
        }
        break;
      }
      case "createComponent": {
        const root = doc.nodes[op.root];
        if (!root || root.type !== "frame") {
          fail(i, `createComponent root must be an existing frame`);
          break;
        }
        const id = op.id ?? idFor("component");
        if (doc.components?.[id]) {
          fail(i, `component ${id} already exists`);
          break;
        }
        const parentId = idx.nodeParent[op.root];
        const pageId = idx.framePage[op.root];
        let fromIndex = -1;
        if (parentId) fromIndex = removeFrom((doc.nodes[parentId] as FrameNode).children, op.root);
        else if (pageId) fromIndex = removeFrom(doc.pages[pageId].frames, op.root);
        if (!doc.components) doc.components = {};
        const def: ComponentDef = {
          id,
          name: op.name,
          root: op.root,
          props: op.props,
          variants: op.variants,
          variantProp: op.variantProp,
          description: op.description,
        };
        doc.components[id] = def;
        changed.add(id);
        changed.add(op.root);
        if (parentId) changed.add(parentId);
        const reattach: Op[] = [{ op: "setComponent", id, component: null }];
        if (parentId) reattach.push({ op: "move", id: op.root, parent: parentId, index: fromIndex });
        else if (pageId) reattach.push({ op: "moveFrame", id: op.root, page: pageId, index: fromIndex });
        inverse.unshift(...reattach);
        break;
      }
      case "setComponent": {
        if (!doc.components) doc.components = {};
        const before = doc.components[op.id] ? clone(doc.components[op.id]) : null;
        if (op.component === null) {
          if (!before) break;
          const usages = componentUsages(doc, op.id);
          if (usages.length) {
            fail(i, `component ${op.id} has ${usages.length} instance(s); delete them first: ${usages.slice(0, 8).join(", ")}`);
            break;
          }
          delete doc.components[op.id];
          changed.add(op.id);
          inverse.unshift({ op: "setComponent", id: op.id, component: before });
          break;
        }
        if (op.component.id !== op.id) {
          fail(i, `setComponent id mismatch (${op.id} vs ${op.component.id})`);
          break;
        }
        if (!doc.nodes[op.component.root] || doc.nodes[op.component.root].type !== "frame") {
          fail(i, `component root ${op.component.root} must be an existing frame`);
          break;
        }
        doc.components[op.id] = clone(op.component);
        changed.add(op.id);
        inverse.unshift({ op: "setComponent", id: op.id, component: before });
        break;
      }
    }
    if (errors.length) return { doc: input, inverse: [], changed: [], errors };
  }

  return { doc, inverse, changed: [...changed] };
}
