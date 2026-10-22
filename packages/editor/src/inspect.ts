import { analyzeLayout, type Doc, type FrameNode, type InspectBox, type InspectReport } from "@cursor-design/core";

function ancestorIds(el: HTMLElement, stop: HTMLElement): string[] {
  const ids: string[] = [];
  let cur: HTMLElement | null = el.parentElement;
  while (cur && cur !== stop) {
    if (cur.dataset.nodeId) ids.push(cur.dataset.nodeId);
    cur = cur.parentElement;
  }
  return ids;
}

function isClipped(el: HTMLElement, root: HTMLElement, rootRect: DOMRect): boolean {
  let cur: HTMLElement | null = el.parentElement;
  const er = el.getBoundingClientRect();
  while (cur && cur !== root) {
    const cs = getComputedStyle(cur);
    const ov = cs.overflow + cs.overflowX + cs.overflowY;
    if (/hidden|scroll|auto|clip/.test(ov)) {
      const pr = cur.getBoundingClientRect();
      if (er.left < pr.left - 1 || er.top < pr.top - 1 || er.right > pr.right + 1 || er.bottom > pr.bottom + 1) return true;
    }
    cur = cur.parentElement;
  }
  // Outside root frame
  if (er.left < rootRect.left - 2 || er.top < rootRect.top - 2 || er.right > rootRect.right + 2 || er.bottom > rootRect.bottom + 2) {
    const cs = getComputedStyle(root);
    if (/hidden|scroll|auto|clip/.test(cs.overflow + cs.overflowX + cs.overflowY)) return true;
  }
  return false;
}

function textOverflows(el: HTMLElement, type: string | undefined): boolean {
  if (type !== "text") return false;
  // Single-line overflow or block taller than laid-out box
  if (el.scrollWidth > el.clientWidth + 1) return true;
  if (el.scrollHeight > el.clientHeight + 2) return true;
  return false;
}

function collectDescendantIds(doc: Doc, id: string, depth: number, out: Set<string>) {
  out.add(id);
  if (depth <= 0) return;
  const n = doc.nodes[id];
  if (n?.type !== "frame") return;
  for (const c of (n as FrameNode).children) collectDescendantIds(doc, c, depth - 1, out);
}

/** Measure rendered layout for `nodeId` and return an inspect report. */
export function inspectNode(doc: Doc, nodeId: string, depth = 4): InspectReport {
  const root = document.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(nodeId)}"]`);
  if (!root) throw new Error(`node ${nodeId} is not rendered (is its page active?)`);

  const allowed = new Set<string>();
  collectDescendantIds(doc, nodeId, depth, allowed);

  const rootRect = root.getBoundingClientRect();
  // Board camera uses CSS zoom (not transform). getBoundingClientRect is in zoomed
  // viewport px; report document-space bounds for the agent.
  const zoom = (root as HTMLElement & { currentCSSZoom?: number }).currentCSSZoom || 1;
  const nodes: InspectBox[] = [];

  const els = root.querySelectorAll<HTMLElement>("[data-node-id]");
  const list: HTMLElement[] = [root, ...Array.from(els)];
  const seen = new Set<string>();

  for (const el of list) {
    const id = el.dataset.nodeId;
    if (!id || seen.has(id) || !allowed.has(id)) continue;
    seen.add(id);
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const n = doc.nodes[id];
    const box: InspectBox = {
      id,
      type: n?.type ?? el.dataset.nodeType,
      name: n?.name,
      x: (r.left - rootRect.left) / zoom,
      y: (r.top - rootRect.top) / zoom,
      w: r.width / zoom,
      h: r.height / zoom,
      style: {
        display: cs.display,
        flexDirection: cs.flexDirection,
        flexGrow: cs.flexGrow,
        overflow: cs.overflow,
        position: cs.position,
      },
      textOverflow: textOverflows(el, n?.type ?? el.dataset.nodeType),
      clipped: id !== nodeId && isClipped(el, root, rootRect),
    };
    // Mark clipped if an ancestor in-tree has overflow and we stick out
    if (!box.clipped && id !== nodeId) {
      for (const aid of ancestorIds(el, root)) {
        const ael = root.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(aid)}"]`) ?? (aid === nodeId ? root : null);
        if (!ael) continue;
        const acs = getComputedStyle(ael);
        if (!/hidden|scroll|auto|clip/.test(acs.overflow + acs.overflowX + acs.overflowY)) continue;
        const ar = ael.getBoundingClientRect();
        if (r.left < ar.left - 1 || r.top < ar.top - 1 || r.right > ar.right + 1 || r.bottom > ar.bottom + 1) {
          box.clipped = true;
          break;
        }
      }
    }
    nodes.push(box);
  }

  return analyzeLayout(nodeId, rootRect.width / zoom, rootRect.height / zoom, nodes);
}
