import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { indexParents, type Doc, type FrameNode, type Op } from "@cursor-design/core";
import { NodeView } from "./NodeView";

type Props = { doc: Doc; pageId: string; selection: string[]; onSelect: (ids: string[]) => void; apply: (ops: Op[]) => void };

type View = { x: number; y: number; z: number };
type Tool = "select" | "hand";
type Corner = "nw" | "ne" | "sw" | "se";
type Rect = { id: string; x: number; y: number; w: number; h: number; notes: number };
type Guides = { x: number | null; y: number | null };
type Drag =
  | { kind: "pan"; sx: number; sy: number; ox: number; oy: number; moved: boolean }
  | { kind: "move"; id: string; sx: number; sy: number; ox: number; oy: number; w: number; h: number; cx: number; cy: number; tx: number[]; ty: number[]; moved: boolean }
  | { kind: "resize"; id: string; corner: Corner; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number; cw: number; ch: number; cx: number; cy: number; tx: number[]; ty: number[]; moved: boolean };

const EMPTY_GUIDES: Guides = { x: null, y: null };
const Z_MIN = 0.05;
const Z_MAX = 8;

function snap(movingEdges: number[], targets: number[], threshold: number): { delta: number; at: number } | null {
  let best: { delta: number; at: number } | null = null;
  for (const e of movingEdges)
    for (const t of targets) {
      const diff = t - e;
      if (Math.abs(diff) <= threshold && (!best || Math.abs(diff) < Math.abs(best.delta))) best = { delta: diff, at: t };
    }
  return best;
}

function zoomAt(v: View, px: number, py: number, nextZ: number): View {
  const z = Math.min(Z_MAX, Math.max(Z_MIN, nextZ));
  return { z, x: px - ((px - v.x) * z) / v.z, y: py - ((py - v.y) * z) / v.z };
}

/** Top-level page frames, or children of an absolute-layout frame, can be free-dragged. */
function isFreePositioned(doc: Doc, id: string, frames: string[], nodeParent: Record<string, string>): boolean {
  if (frames.includes(id)) return true;
  const parent = doc.nodes[nodeParent[id]];
  return parent?.type === "frame" && (parent as FrameNode).layout?.mode === "absolute";
}

/** Node id chain under the pointer: deepest first → top-level last. */
function nodeChainFromEvent(target: EventTarget | null, vpEl: HTMLElement): string[] {
  const start = (target as HTMLElement | null)?.closest?.<HTMLElement>("[data-node-id]");
  if (!start || !vpEl.contains(start)) return [];
  const chain: string[] = [];
  let el: HTMLElement | null = start;
  while (el && el !== vpEl) {
    if (el.dataset.nodeId) chain.push(el.dataset.nodeId);
    el = el.parentElement;
  }
  return chain;
}

export function Board({ doc, pageId, selection, onSelect, apply }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ x: 40, y: 40, z: 1 });
  const [tool, setTool] = useState<Tool>("select");
  const [spaceDown, setSpaceDown] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [rects, setRects] = useState<Rect[]>([]);
  const [guides, setGuides] = useState<Guides>(EMPTY_GUIDES);
  const page = doc.pages[pageId];
  const frames = page?.frames ?? [];
  const drag = useRef<Drag | null>(null);
  const fitted = useRef<string>("");
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const spaceRef = useRef(spaceDown);
  spaceRef.current = spaceDown;
  const parents = useMemo(() => indexParents(doc), [doc]);

  const panning = tool === "hand" || spaceDown;

  const noteCount = useCallback(
    (id: string) => (doc.annotations ? Object.values(doc.annotations).filter((a) => a.nodeId === id && a.status !== "resolved").length : 0),
    [doc.annotations],
  );

  const fitPage = useCallback(() => {
    const vpEl = viewportRef.current;
    if (!vpEl) return;
    const vp = vpEl.getBoundingClientRect();
    if (frames.length === 0) return setView({ x: 40, y: 40, z: 1 });
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const f of frames) {
      const n = doc.nodes[f];
      if (!n) continue;
      const w = typeof n.width === "number" ? n.width : 390;
      const h = typeof n.height === "number" ? n.height : 400;
      minX = Math.min(minX, n.x ?? 0);
      minY = Math.min(minY, n.y ?? 0);
      maxX = Math.max(maxX, (n.x ?? 0) + w);
      maxY = Math.max(maxY, (n.y ?? 0) + h);
    }
    const z = Math.min(1, (vp.width - 80) / Math.max(1, maxX - minX), (vp.height - 80) / Math.max(1, maxY - minY));
    setView({ z, x: (vp.width - (maxX - minX) * z) / 2 - minX * z, y: (vp.height - (maxY - minY) * z) / 2 - minY * z });
  }, [frames, doc.nodes]);

  useLayoutEffect(() => {
    if (fitted.current === pageId) return;
    fitted.current = pageId;
    fitPage();
  }, [pageId, fitPage]);

  /**
   * Selection overlay lives inside `.world` (document space). CSS `zoom` scales that
   * subtree visually; getBoundingClientRect returns zoomed screen px, so divide by the
   * effective zoom to get stable layout boxes that track the camera.
   */
  const measure = useCallback(() => {
    const vp = viewportRef.current;
    const world = vp?.querySelector<HTMLElement>(".world");
    if (!vp || !world) return;
    const wr = world.getBoundingClientRect();
    const z =
      (world as HTMLElement & { currentCSSZoom?: number }).currentCSSZoom ||
      Number.parseFloat(getComputedStyle(world).zoom) ||
      view.z ||
      1;
    const out: Rect[] = [];
    for (const id of selection) {
      const el = vp.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(id)}"]`);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      out.push({
        id,
        x: (r.left - wr.left) / z,
        y: (r.top - wr.top) / z,
        w: r.width / z,
        h: r.height / z,
        notes: noteCount(id),
      });
    }
    setRects(out);
  }, [selection, noteCount, view.z]);

  useLayoutEffect(() => {
    measure();
  }, [measure, doc, view, pageId]);

  /** Snap against sibling free-positioned nodes (page frames, or children of the same absolute parent). */
  const collectTargets = useCallback((exclude: string) => {
    const vp = viewportRef.current!;
    const tx: number[] = [], ty: number[] = [];
    const parentId = parents.nodeParent[exclude];
    const siblingIds = parentId
      ? ((doc.nodes[parentId] as FrameNode | undefined)?.children ?? []).filter((c) => c !== exclude)
      : frames.filter((f) => f !== exclude);
    for (const id of siblingIds) {
      const n = doc.nodes[id];
      if (!n) continue;
      const el = vp.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(id)}"]`);
      const w = el?.offsetWidth ?? (typeof n.width === "number" ? n.width : 0);
      const h = el?.offsetHeight ?? (typeof n.height === "number" ? n.height : 0);
      const x = n.x ?? 0, y = n.y ?? 0;
      tx.push(x, x + w / 2, x + w);
      ty.push(y, y + h / 2, y + h);
    }
    return { tx, ty };
  }, [frames, doc.nodes, parents.nodeParent]);

  const zoomBy = useCallback((factor: number, clientX?: number, clientY?: number) => {
    const vp = viewportRef.current?.getBoundingClientRect();
    if (!vp) return;
    const px = clientX != null ? clientX - vp.left : vp.width / 2;
    const py = clientY != null ? clientY - vp.top : vp.height / 2;
    setView((v) => zoomAt(v, px, py, v.z * factor));
  }, []);

  const zoomTo = useCallback((z: number) => {
    const vp = viewportRef.current?.getBoundingClientRect();
    if (!vp) return;
    setView((v) => zoomAt(v, vp.width / 2, vp.height / 2, z));
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const vp = viewportRef.current!.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) {
      const px = e.clientX - vp.left, py = e.clientY - vp.top;
      setView((v) => zoomAt(v, px, py, v.z * Math.exp(-e.deltaY * 0.01)));
    } else setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const h = (e: WheelEvent) => e.preventDefault();
    el.addEventListener("wheel", h, { passive: false });
    return () => el.removeEventListener("wheel", h);
  }, []);

  useEffect(() => {
    const isTyping = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        setSpaceDown(true);
        return;
      }
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "=" || e.key === "+") { e.preventDefault(); zoomBy(1.25); return; }
        if (e.key === "-" || e.key === "_") { e.preventDefault(); zoomBy(0.8); return; }
        if (e.key === "0") { e.preventDefault(); fitPage(); return; }
        if (e.key === "1") { e.preventDefault(); zoomTo(1); return; }
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "v" || e.key === "V") setTool("select");
      if (e.key === "h" || e.key === "H") setTool("hand");
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceDown(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [zoomBy, zoomTo, fitPage]);

  const startResize = (id: string, corner: Corner, e: React.PointerEvent) => {
    e.stopPropagation();
    if (spaceRef.current || toolRef.current === "hand") return;
    const vpEl = viewportRef.current!;
    const el = vpEl.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(id)}"]`);
    if (!el) return;
    const n = doc.nodes[id];
    const { tx, ty } = collectTargets(id);
    vpEl.setPointerCapture(e.pointerId);
    drag.current = {
      kind: "resize", id, corner, sx: e.clientX, sy: e.clientY,
      ox: n?.x ?? 0, oy: n?.y ?? 0, ow: el.offsetWidth, oh: el.offsetHeight,
      cw: el.offsetWidth, ch: el.offsetHeight, cx: n?.x ?? 0, cy: n?.y ?? 0, tx, ty, moved: false,
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    // Zoom / tool chrome must never start a pan (that was clearing selection on click).
    if ((e.target as HTMLElement).closest?.(".board-tools, .zoom-bar, .overlay .handle, .overlay .pin")) return;

    if (e.button === 1) {
      e.preventDefault();
      const vpEl = viewportRef.current!;
      vpEl.setPointerCapture(e.pointerId);
      drag.current = { kind: "pan", sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y, moved: false };
      return;
    }
    if (e.button !== 0) return;
    const vpEl = viewportRef.current!;
    vpEl.setPointerCapture(e.pointerId);

    const wantPan = spaceRef.current || toolRef.current === "hand";
    if (wantPan) {
      drag.current = { kind: "pan", sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y, moved: false };
      return;
    }

    const chain = nodeChainFromEvent(e.target, vpEl);
    if (chain.length) {
      // Prefer the deepest selected node in the chain (so nested absolute children move, not the artboard).
      const id = chain.find((nid) => selection.includes(nid));
      const n = id ? doc.nodes[id] : undefined;
      const el = id ? vpEl.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(id)}"]`) : null;
      if (id && n && el && isFreePositioned(doc, id, frames, parents.nodeParent)) {
        const { tx, ty } = collectTargets(id);
        drag.current = {
          kind: "move", id, sx: e.clientX, sy: e.clientY, ox: n.x ?? 0, oy: n.y ?? 0,
          w: el.offsetWidth, h: el.offsetHeight, cx: n.x ?? 0, cy: n.y ?? 0, tx, ty, moved: false,
        };
        return;
      }
      drag.current = null;
      return; // selection via NodeView onPick
    }

    // Empty board → pan; click without move clears selection.
    drag.current = { kind: "pan", sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (Math.abs(dx) + Math.abs(dy) > 2) d.moved = true;
    if (d.kind === "pan") {
      if (d.moved) setIsPanning(true);
      setView((v) => ({ ...v, x: d.ox + dx, y: d.oy + dy }));
      return;
    }
    const el = viewportRef.current!.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(d.id)}"]`);
    if (!el) return;
    // Screen-px threshold → document space. Slightly wider than 6 so CSS-zoom cameras still snap.
    const t = 12 / view.z;
    if (d.kind === "move") {
      let nx = d.ox + dx / view.z, ny = d.oy + dy / view.z;
      const sx = snap([nx, nx + d.w / 2, nx + d.w], d.tx, t);
      const sy = snap([ny, ny + d.h / 2, ny + d.h], d.ty, t);
      if (sx) nx += sx.delta;
      if (sy) ny += sy.delta;
      d.cx = nx; d.cy = ny;
      el.style.left = `${nx}px`;
      el.style.top = `${ny}px`;
      // Nested absolute children are already position:absolute; ensure during live drag.
      el.style.position = "absolute";
      setGuides({ x: sx?.at ?? null, y: sy?.at ?? null });
    } else {
      const ddx = dx / view.z, ddy = dy / view.z;
      const west = d.corner === "nw" || d.corner === "sw";
      const north = d.corner === "nw" || d.corner === "ne";
      let w = Math.max(8, Math.round(d.ow + (west ? -ddx : ddx)));
      let h = Math.max(8, Math.round(d.oh + (north ? -ddy : ddy)));
      let left = west ? d.ox + (d.ow - w) : d.ox;
      let top = north ? d.oy + (d.oh - h) : d.oy;
      const movingX = west ? left : left + w;
      const sx = snap([movingX], d.tx, t);
      if (sx) { if (west) { w -= sx.delta; left += sx.delta; } else w += sx.delta; }
      const movingY = north ? top : top + h;
      const sy = snap([movingY], d.ty, t);
      if (sy) { if (north) { h -= sy.delta; top += sy.delta; } else h += sy.delta; }
      w = Math.max(8, Math.round(w)); h = Math.max(8, Math.round(h));
      d.cw = w; d.ch = h; d.cx = Math.round(left); d.cy = Math.round(top);
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      el.style.flexGrow = "0";
      el.style.flexBasis = "auto";
      el.style.alignSelf = "auto";
      if (isFreePositioned(doc, d.id, frames, parents.nodeParent)) {
        el.style.position = "absolute";
        el.style.left = `${d.cx}px`;
        el.style.top = `${d.cy}px`;
      }
      setGuides({ x: sx?.at ?? null, y: sy?.at ?? null });
    }
    measure();
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    setIsPanning(false);
    setGuides(EMPTY_GUIDES);
    if (!d) return;
    if (d.kind === "pan" && !d.moved && toolRef.current === "select" && !spaceRef.current) {
      onSelect([]);
      return;
    }
    if (d.kind === "move" && d.moved) {
      apply([{ op: "update", id: d.id, set: { x: Math.round(d.cx), y: Math.round(d.cy) } }]);
    }
    if (d.kind === "resize" && d.moved) {
      const set: Record<string, number> = { width: d.cw, height: d.ch };
      if (isFreePositioned(doc, d.id, frames, parents.nodeParent)) {
        set.x = d.cx;
        set.y = d.cy;
      }
      apply([{ op: "update", id: d.id, set }]);
    }
  };

  const onPick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (spaceRef.current || toolRef.current === "hand") return;
    if (drag.current?.moved) return;
    onSelect(e.shiftKey ? (selection.includes(id) ? selection.filter((s) => s !== id) : [...selection, id]) : [id]);
  };

  const single = selection.length === 1;
  const guideX = guides.x;
  const guideY = guides.y;
  const pct = Math.round(view.z * 100);
  // Keep chrome (stroke / handles) ~constant on screen while the overlay zooms with .world
  const invZ = 1 / Math.max(0.05, view.z);
  const handle = 8 * invZ;
  const handleHalf = handle / 2;
  const pinR = 9 * invZ;

  return (
    <main
      className={`board tool-${panning ? "hand" : "select"}${isPanning ? " is-panning" : ""}`}
      ref={viewportRef}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {!page && <div className="board-empty">No page selected</div>}
      {page && frames.length === 0 && (
        <div className="board-empty">
          <strong>{page.name} is empty</strong>
          <span>Ask Cursor to build a frame here.</span>
        </div>
      )}
      {/*
        Camera uses left/top + CSS zoom — not transform:scale. An ancestor transform
        becomes a Chromium backdrop root and silently breaks document backdropBlur.
        Selection overlay is inside .world so boxes track zoom with the nodes.
      */}
      <div className="world" style={{ left: view.x, top: view.y, zoom: view.z } as CSSProperties}>
        {frames.map((f) => (
          <NodeView key={f} doc={doc} id={f} topLevel selected={new Set(selection)} onPick={onPick} />
        ))}
        {frames.map((f) => {
          const n = doc.nodes[f];
          if (!n) return null;
          return (
            <div
              key={`${f}-label`}
              className="frame-label"
              style={{ left: n.x ?? 0, top: (n.y ?? 0) - 22 / view.z, zoom: 1 / view.z } as CSSProperties}
              onClick={(e) => onPick(f, e)}
            >
              {n.name ?? f} <span>{typeof n.width === "number" && typeof n.height === "number" ? `${n.width} × ${n.height}` : ""}</span>
            </div>
          );
        })}
        <svg className="overlay" style={{ overflow: "visible" }}>
          {guideX !== null && <line className="guide" x1={guideX} y1={-1e5} x2={guideX} y2={1e5} strokeWidth={invZ} />}
          {guideY !== null && <line className="guide" x1={-1e5} y1={guideY} x2={1e5} y2={guideY} strokeWidth={invZ} />}
          {rects.map((r) => (
            <g key={r.id}>
              <rect x={r.x} y={r.y} width={r.w} height={r.h} className="sel" style={{ strokeWidth: 1.5 * invZ }} />
              {single && !panning &&
                (["nw", "ne", "sw", "se"] as Corner[]).map((c) => {
                  const hx = c === "nw" || c === "sw" ? r.x : r.x + r.w;
                  const hy = c === "nw" || c === "ne" ? r.y : r.y + r.h;
                  return (
                    <rect
                      key={c}
                      x={hx - handleHalf}
                      y={hy - handleHalf}
                      width={handle}
                      height={handle}
                      className="handle"
                      data-corner={c}
                      style={{ strokeWidth: invZ }}
                      onPointerDown={(e) => startResize(r.id, c, e)}
                    />
                  );
                })}
              {r.notes > 0 && (
                <g className="pin" onClick={(e) => { e.stopPropagation(); if (!panning) onSelect([r.id]); }}>
                  <circle cx={r.x + r.w - 2} cy={r.y + 2} r={pinR} />
                  <text x={r.x + r.w - 2} y={r.y + 2} dy="0.35em" textAnchor="middle" style={{ fontSize: 10 * invZ }}>
                    {r.notes}
                  </text>
                </g>
              )}
            </g>
          ))}
        </svg>
      </div>

      <div className="board-tools" role="toolbar" aria-label="Pointer tools" onPointerDown={(e) => e.stopPropagation()}>
        <button type="button" className={`tool ${tool === "select" && !spaceDown ? "active" : ""}`} title="Select (V)" aria-pressed={tool === "select"} onClick={() => setTool("select")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M4 3l7.5 18 2.2-7.3L21 11.5 4 3z" /></svg>
        </button>
        <button type="button" className={`tool ${tool === "hand" || spaceDown ? "active" : ""}`} title="Hand / pan (H, hold Space)" aria-pressed={tool === "hand"} onClick={() => setTool("hand")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M8 13V6a1.5 1.5 0 0 1 3 0v5" />
            <path d="M11 11V4a1.5 1.5 0 0 1 3 0v7" />
            <path d="M14 11V5a1.5 1.5 0 0 1 3 0v8" />
            <path d="M17 12v-1a1.5 1.5 0 0 1 3 0v5a6 6 0 0 1-6 6h-2a7 7 0 0 1-5.5-2.7L5 14.5a1.5 1.5 0 0 1 2.4-1.8L9 15" />
          </svg>
        </button>
      </div>

      <div className="zoom-bar" role="toolbar" aria-label="Zoom" onPointerDown={(e) => e.stopPropagation()}>
        <button type="button" className="tool" title="Zoom out (⌘−)" onClick={() => zoomBy(0.8)}>−</button>
        <button type="button" className="zoom-pct" title="Reset to 100% (⌘1)" onClick={() => zoomTo(1)}>{pct}%</button>
        <button type="button" className="tool" title="Zoom in (⌘+)" onClick={() => zoomBy(1.25)}>+</button>
        <button type="button" className="tool zoom-fit" title="Fit page (⌘0)" onClick={fitPage}>Fit</button>
      </div>
    </main>
  );
}
