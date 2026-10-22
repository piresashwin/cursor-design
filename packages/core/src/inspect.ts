/** Measured layout box (coordinates relative to the inspect root). */
export type InspectBox = {
  id: string;
  type?: string;
  name?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Subset of computed CSS useful for layout debugging. */
  style?: {
    display?: string;
    flexDirection?: string;
    flexGrow?: string;
    overflow?: string;
    position?: string;
  };
  /** True when content scrolls/clips inside this node (text wrap overflow, etc.). */
  textOverflow?: boolean;
  /** True when this box extends outside an ancestor with overflow ≠ visible. */
  clipped?: boolean;
};

export type InspectOverlap = { a: string; b: string; area: number };

export type InspectIssue = {
  severity: "warn" | "error";
  code: "overlap" | "clipped" | "text-overflow" | "zero-size" | "outside-root";
  nodeIds: string[];
  message: string;
};

export type InspectReport = {
  rootId: string;
  width: number;
  height: number;
  nodes: InspectBox[];
  overlaps: InspectOverlap[];
  issues: InspectIssue[];
};

function overlapArea(a: InspectBox, b: InspectBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const w = x2 - x1;
  const h = y2 - y1;
  if (w <= 0 || h <= 0) return 0;
  return Math.round(w * h);
}

/** Pure layout analysis from measured boxes (DOM or synthetic). */
export function analyzeLayout(rootId: string, rootW: number, rootH: number, nodes: InspectBox[]): InspectReport {
  const overlaps: InspectOverlap[] = [];
  const issues: InspectIssue[] = [];

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      // Skip nested pairs (one fully contains the other) — normal parent/child.
      const aInB = a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;
      const bInA = b.x >= a.x && b.y >= a.y && b.x + b.w <= a.x + a.w && b.y + b.h <= a.y + a.h;
      if (aInB || bInA) continue;
      const area = overlapArea(a, b);
      if (area < 4) continue; // ignore 1px hairlines
      overlaps.push({ a: a.id, b: b.id, area });
      issues.push({
        severity: "warn",
        code: "overlap",
        nodeIds: [a.id, b.id],
        message: `${a.name ?? a.id} overlaps ${b.name ?? b.id} (~${area}px²)`,
      });
    }
  }

  for (const n of nodes) {
    if (n.w < 0.5 || n.h < 0.5) {
      issues.push({
        severity: "warn",
        code: "zero-size",
        nodeIds: [n.id],
        message: `${n.name ?? n.id} has near-zero size (${Math.round(n.w)}×${Math.round(n.h)})`,
      });
    }
    if (n.clipped) {
      issues.push({
        severity: "warn",
        code: "clipped",
        nodeIds: [n.id],
        message: `${n.name ?? n.id} is clipped by an overflow-hidden ancestor`,
      });
    }
    if (n.textOverflow) {
      issues.push({
        severity: "warn",
        code: "text-overflow",
        nodeIds: [n.id],
        message: `${n.name ?? n.id} text overflows its box (wrapping/clipping)`,
      });
    }
    if (n.id !== rootId && (n.x + n.w < -1 || n.y + n.h < -1 || n.x > rootW + 1 || n.y > rootH + 1)) {
      issues.push({
        severity: "warn",
        code: "outside-root",
        nodeIds: [n.id],
        message: `${n.name ?? n.id} lies mostly outside the root frame`,
      });
    }
  }

  return {
    rootId,
    width: Math.round(rootW),
    height: Math.round(rootH),
    nodes: nodes.map((n) => ({
      ...n,
      x: Math.round(n.x * 10) / 10,
      y: Math.round(n.y * 10) / 10,
      w: Math.round(n.w * 10) / 10,
      h: Math.round(n.h * 10) / 10,
    })),
    overlaps,
    issues,
  };
}
