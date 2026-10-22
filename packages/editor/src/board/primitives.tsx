import { createElement, type CSSProperties } from "react";
import {
  ICONS,
  resolve,
  type Doc,
  type IconNode,
  type ShapeNode,
  type ChartNode,
  type AvatarNode,
  type ProgressNode,
  type SkeletonNode,
} from "@cursor-design/core";

const PALETTE = ["#6366F1", "#22C55E", "#F59E0B", "#EF4444", "#06B6D4", "#A855F7", "#EC4899", "#84CC16"];
const AXIS = "#94A3B8";
const GRID = "#E2E8F0";

function color(doc: Doc, v: unknown, fallback: string): string {
  if (typeof v !== "string") return fallback;
  const r = resolve(doc, v);
  return typeof r === "string" ? r : fallback;
}

// ---- icon: inline Lucide paths (24x24, stroke-based) ----
export function IconSvg({ doc, node }: { doc: Doc; node: IconNode }) {
  const def = ICONS[node.name];
  const stroke = color(doc, node.fill, "currentColor");
  if (!def) {
    return (
      <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="#CBD5E1" strokeWidth={1.5}>
        <rect x={2} y={2} width={20} height={20} rx={3} strokeDasharray="3 3" />
        <path d="M9 9h6M12 9v6" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke={stroke} strokeWidth={node.strokeWidth ?? 2} strokeLinecap="round" strokeLinejoin="round">
      {def.map(([tag, attrs], i) => createElement(tag, { key: i, ...attrs }))}
    </svg>
  );
}

// ---- shape: parametric vector ----
function polyPoints(cx: number, cy: number, r: number, sides: number, rot: number) {
  const pts: string[] = [];
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
}
function starPoints(cx: number, cy: number, r: number, inner: number, points: number, rot: number) {
  const pts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? r : inner;
    const a = rot + (i / (points * 2)) * Math.PI * 2;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(2)},${(cy + rad * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
}

/** Deterministic pseudo-random from seed. */
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function blobPath(seed: number, complexity: number): string {
  const rnd = mulberry32(seed || 1);
  const n = Math.max(5, Math.min(16, Math.round(complexity || 8)));
  const cx = 50,
    cy = 50;
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const r = 28 + rnd() * 20;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  // smooth-ish closed path via midpoints
  let d = "";
  for (let i = 0; i < n; i++) {
    const p0 = pts[i];
    const p1 = pts[(i + 1) % n];
    const mx = (p0.x + p1.x) / 2;
    const my = (p0.y + p1.y) / 2;
    if (i === 0) d += `M${mx.toFixed(2)} ${my.toFixed(2)}`;
    else d += ` Q${p0.x.toFixed(2)} ${p0.y.toFixed(2)} ${mx.toFixed(2)} ${my.toFixed(2)}`;
  }
  return d + " Z";
}

export function ShapeSvg({ doc, node }: { doc: Doc; node: ShapeNode }) {
  const fill = color(doc, node.fill, PALETTE[0]);
  const stroke = node.stroke ? color(doc, node.stroke.color, "none") : "none";
  const sw = node.stroke?.width ?? (node.kind === "line" ? 3 : 0);
  const rot = -Math.PI / 2;
  let el;
  if (node.kind === "line") {
    const dir = node.direction === "vertical" ? "vertical" : "horizontal";
    const strokeCol = node.stroke ? stroke : fill;
    el =
      dir === "vertical" ? (
        <line x1={50} y1={8} x2={50} y2={92} stroke={strokeCol} strokeWidth={sw} strokeLinecap="round" />
      ) : (
        <line x1={8} y1={50} x2={92} y2={50} stroke={strokeCol} strokeWidth={sw} strokeLinecap="round" />
      );
  } else if (node.kind === "blob") {
    el = <path d={blobPath(node.seed ?? 42, node.complexity ?? 8)} fill={fill} stroke={stroke} strokeWidth={sw} />;
  } else if (node.kind === "arrow") {
    const dir = node.direction ?? "right";
    const base = "M10 50 L60 50 L60 30 L90 50 L60 70 L60 50";
    const transform = dir === "left" ? "rotate(180 50 50)" : dir === "up" ? "rotate(-90 50 50)" : dir === "down" ? "rotate(90 50 50)" : undefined;
    el = <path d={base} transform={transform} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />;
  } else if (node.kind === "star") {
    el = <polygon points={starPoints(50, 50, 48, 48 * (node.innerRatio ?? 0.5), node.sides ?? 5, rot)} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />;
  } else {
    el = <polygon points={polyPoints(50, 50, 48, node.sides ?? 6, rot)} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />;
  }
  return <svg viewBox="0 0 100 100" width="100%" height="100%">{el}</svg>;
}

// ---- chart: deterministic hand-rolled SVG ----
function arc(cx: number, cy: number, rOuter: number, rInner: number, a0: number, a1: number) {
  const p = (r: number, a: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = p(rOuter, a0),
    [x1, y1] = p(rOuter, a1);
  const [x2, y2] = p(rInner, a1),
    [x3, y3] = p(rInner, a0);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${rOuter} ${rOuter} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} L${x2.toFixed(2)} ${y2.toFixed(2)} A${rInner} ${rInner} 0 ${large} 0 ${x3.toFixed(2)} ${y3.toFixed(2)} Z`;
}

function resolveChrome(kind: string, options: NonNullable<ChartNode["chart"]["options"]>) {
  if (options.chrome) return options.chrome;
  if (kind === "donut" || kind === "sparkline") return "none" as const;
  if (options.axis === false && options.grid === false) return "none" as const;
  if (options.axis === false) return "minimal" as const;
  if (options.axis === true || options.grid === true) return "full" as const;
  return "minimal" as const; // dashboard-friendly default when unspecified
}

export function ChartSvg({ doc, node, w, h }: { doc: Doc; node: ChartNode; w: number; h: number }) {
  const { kind, labels = [], series, options = {} } = node.chart;
  const seriesColor = (i: number, c?: string) => color(doc, c, PALETTE[i % PALETTE.length]);
  const chrome = resolveChrome(kind, options);
  const showYAxis = chrome === "full" && (options.axis ?? true);
  const showGrid = chrome === "full" ? (options.grid ?? true) : chrome === "minimal" ? options.grid === true : false;
  const showCatLabels = chrome !== "none" && labels.length > 0 && (chrome === "full" || chrome === "minimal");
  const sw = options.strokeWidth ?? (kind === "sparkline" ? 2 : 2.5);
  const fillOp = options.fillOpacity ?? (kind === "sparkline" ? 0.22 : 0.18);
  const roundRx = options.rounded === true ? 6 : typeof options.rounded === "number" ? options.rounded : chrome === "none" ? 2 : 4;
  const showDots = options.showDots ?? (kind === "line" && chrome !== "none");
  const valueLabels = options.valueLabels;
  const hi = options.highlight;
  const stacked = options.stacked === true;

  if (kind === "sparkline") {
    const vals = series[0]?.values ?? [];
    const n = Math.max(1, vals.length);
    const max = options.max ?? Math.max(1, ...vals);
    const min = Math.min(0, ...vals);
    const span = max - min || 1;
    const pad = 2;
    const pts = vals.map((v, i) => {
      const x = pad + (n === 1 ? (w - pad * 2) / 2 : (i / (n - 1)) * (w - pad * 2));
      const y = pad + (1 - (v - min) / span) * (h - pad * 2);
      return [x, y] as const;
    });
    const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(" ");
    const col = seriesColor(0, series[0]?.color);
    const doFill = options.fill ?? true;
    const gid = `spfill-${node.id}`;
    return (
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={col} stopOpacity={fillOp * 1.4} />
            <stop offset="100%" stopColor={col} stopOpacity={0} />
          </linearGradient>
        </defs>
        {doFill && pts.length > 1 && (
          <path
            d={`${line} L${pts[pts.length - 1][0].toFixed(2)} ${h - pad} L${pts[0][0].toFixed(2)} ${h - pad} Z`}
            fill={`url(#${gid})`}
          />
        )}
        <path d={line} fill="none" stroke={col} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        {options.goal != null && (
          <line
            x1={pad}
            y1={pad + (1 - (options.goal - min) / span) * (h - pad * 2)}
            x2={w - pad}
            y2={pad + (1 - (options.goal - min) / span) * (h - pad * 2)}
            stroke={AXIS}
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={0.7}
          />
        )}
        {(valueLabels === true || valueLabels === "last") &&
          pts.map((p, i) => {
            if (valueLabels === "last" && i !== pts.length - 1) return null;
            return (
              <text key={i} x={p[0]} y={p[1] - 4} textAnchor="middle" fontSize={8} fill={col}>
                {vals[i]}
              </text>
            );
          })}
      </svg>
    );
  }

  const padL = showYAxis ? 30 : 8;
  const padR = 10;
  const padT = 10;
  const padB = showCatLabels ? 20 : 8;
  const plotW = Math.max(1, w - padL - padR);
  const plotH = Math.max(1, h - padT - padB);

  if (kind === "donut") {
    const vals = series[0]?.values ?? [];
    const total = vals.reduce((a, b) => a + b, 0) || 1;
    const cx = w / 2,
      cy = h / 2;
    const rOuter = Math.min(w, h) / 2 - 6,
      rInner = rOuter * 0.6;
    let a = -Math.PI / 2;
    return (
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%">
        {vals.map((v, i) => {
          const a1 = a + (v / total) * Math.PI * 2;
          const d = arc(cx, cy, rOuter, rInner, a, a1);
          a = a1;
          const dim = hi != null && hi !== i;
          return <path key={i} d={d} fill={seriesColor(i, series[0]?.color)} opacity={dim ? 0.35 : 1} />;
        })}
      </svg>
    );
  }

  const n = Math.max(1, ...series.map((s) => s.values.length));
  const stackedTotals = stacked
    ? Array.from({ length: n }, (_, i) => series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0))
    : [];
  const max =
    options.max ??
    (stacked ? Math.max(1, ...stackedTotals, options.goal ?? 0) : Math.max(1, ...series.flatMap((s) => s.values), options.goal ?? 0));
  const y = (v: number) => padT + plotH - (v / max) * plotH;
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const markOpacity = (i: number) => (hi == null || hi === i ? 1 : 0.35);
  const uid = node.id.replace(/[^a-zA-Z0-9_-]/g, "");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" fontFamily="ui-sans-serif, system-ui, sans-serif">
      <defs>
        {series.map((s, si) => {
          const col = seriesColor(si, s.color);
          return (
            <linearGradient key={si} id={`chgrad-${uid}-${si}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={col} stopOpacity={1} />
              <stop offset="100%" stopColor={col} stopOpacity={0.55} />
            </linearGradient>
          );
        })}
      </defs>

      {showGrid &&
        ticks.map((t, i) => {
          const yy = padT + plotH - t * plotH;
          return (
            <g key={i}>
              <line x1={padL} y1={yy} x2={padL + plotW} y2={yy} stroke={GRID} strokeWidth={1} />
              {showYAxis && (
                <text x={padL - 4} y={yy + 3} textAnchor="end" fontSize={8} fill={AXIS}>
                  {Math.round(max * t)}
                </text>
              )}
            </g>
          );
        })}
      {showYAxis && <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke={AXIS} strokeWidth={1} />}

      {kind === "bar" &&
        (stacked
          ? Array.from({ length: n }, (_, i) => {
              let acc = 0;
              const groupW = plotW / n;
              const barW = groupW * 0.7;
              const x = padL + i * groupW + groupW * 0.15;
              return series.map((s, si) => {
                const v = s.values[i] ?? 0;
                const y0 = acc;
                acc += v;
                const top = y(acc);
                const bot = y(y0);
                const bh = Math.max(0, bot - top);
                const useGrad = options.fill !== false;
                return (
                  <rect
                    key={`${si}-${i}`}
                    x={x}
                    y={top}
                    width={Math.max(1, barW)}
                    height={bh}
                    rx={si === series.length - 1 ? roundRx : 0}
                    fill={useGrad ? `url(#chgrad-${uid}-${si})` : seriesColor(si, s.color)}
                    opacity={markOpacity(i)}
                  />
                );
              });
            })
          : series.map((s, si) =>
              s.values.map((v, i) => {
                const groupW = plotW / n;
                const barW = (groupW * 0.7) / series.length;
                const x = padL + i * groupW + groupW * 0.15 + si * barW;
                const bh = (v / max) * plotH;
                const useGrad = options.fill !== false;
                return (
                  <rect
                    key={`${si}-${i}`}
                    x={x}
                    y={padT + plotH - bh}
                    width={Math.max(1, barW - 1)}
                    height={bh}
                    rx={roundRx}
                    fill={useGrad ? `url(#chgrad-${uid}-${si})` : seriesColor(si, s.color)}
                    opacity={markOpacity(i)}
                  />
                );
              }),
            ))}

      {kind === "bar" &&
        (valueLabels === true || valueLabels === "last") &&
        series.map((s, si) =>
          s.values.map((v, i) => {
            if (valueLabels === "last" && i !== s.values.length - 1) return null;
            if (stacked && si !== series.length - 1) return null;
            const groupW = plotW / n;
            const x = stacked
              ? padL + i * groupW + groupW / 2
              : padL + i * groupW + groupW * 0.15 + si * ((groupW * 0.7) / series.length) + ((groupW * 0.7) / series.length) / 2;
            const yy = stacked ? y(stackedTotals[i] ?? v) - 4 : y(v) - 4;
            return (
              <text key={`vl-${si}-${i}`} x={x} y={yy} textAnchor="middle" fontSize={8} fill={AXIS} opacity={markOpacity(i)}>
                {stacked ? stackedTotals[i] : v}
              </text>
            );
          }),
        )}

      {(kind === "line" || kind === "area") &&
        series.map((s, si) => {
          const vals = stacked
            ? s.values.map((_, i) => series.slice(0, si + 1).reduce((sum, ss) => sum + (ss.values[i] ?? 0), 0))
            : s.values;
          const pts = vals.map((v, i) => [padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW), y(v)] as const);
          const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(" ");
          const col = seriesColor(si, s.color);
          const underFill = kind === "area" ? options.fill !== false : options.fill === true;
          return (
            <g key={si}>
              {underFill && pts.length > 1 && (
                <path
                  d={`${line} L${pts[pts.length - 1][0].toFixed(2)} ${padT + plotH} L${pts[0][0].toFixed(2)} ${padT + plotH} Z`}
                  fill={col}
                  fillOpacity={fillOp}
                />
              )}
              <path d={line} fill="none" stroke={col} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
              {showDots &&
                pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={2.5} fill={col} opacity={markOpacity(i)} />)}
              {(valueLabels === true || valueLabels === "last") &&
                pts.map((p, i) => {
                  if (valueLabels === "last" && i !== pts.length - 1) return null;
                  return (
                    <text key={`vl-${i}`} x={p[0]} y={p[1] - 5} textAnchor="middle" fontSize={8} fill={col} opacity={markOpacity(i)}>
                      {s.values[i]}
                    </text>
                  );
                })}
            </g>
          );
        })}

      {options.goal != null && (
        <line
          x1={padL}
          y1={y(options.goal)}
          x2={padL + plotW}
          y2={y(options.goal)}
          stroke={AXIS}
          strokeWidth={1.25}
          strokeDasharray="4 3"
          opacity={0.85}
        />
      )}

      {showCatLabels &&
        labels.slice(0, n).map((lab, i) => {
          const groupW = plotW / n;
          const x = kind === "bar" ? padL + i * groupW + groupW / 2 : padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
          return (
            <text key={i} x={x} y={padT + plotH + 12} textAnchor="middle" fontSize={8} fill={AXIS} opacity={markOpacity(i)}>
              {lab}
            </text>
          );
        })}
    </svg>
  );
}

// ---- widgets: avatar / progress / skeleton ----

export function AvatarView({ doc, node }: { doc: Doc; node: AvatarNode }) {
  const size = node.size ?? (typeof node.width === "number" ? node.width : 40);
  const bg = color(doc, node.fill, "#334155");
  const fg = color(doc, node.textFill, "#F8FAFC");
  const rad = node.radius != null ? undefined : "50%"; // default circle; radius applied by NodeView when set
  const style: CSSProperties = {
    width: "100%",
    height: "100%",
    borderRadius: rad,
    background: bg,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    fontFamily: "ui-sans-serif, system-ui, sans-serif",
    fontWeight: 600,
    fontSize: Math.max(10, size * 0.36),
    color: fg,
    boxSizing: "border-box",
  };
  if (node.ring) {
    style.boxShadow = `0 0 0 ${node.ring.width}px ${color(doc, node.ring.color, "#fff")}`;
  }
  if (node.src) {
    return <img src={node.src} alt={node.initials ?? node.name ?? "avatar"} style={{ ...style, objectFit: "cover" }} />;
  }
  const initials = (node.initials ?? "?").slice(0, 2).toUpperCase();
  return <div style={style}>{initials}</div>;
}

export function ProgressView({ doc, node, w, h }: { doc: Doc; node: ProgressNode; w: number; h: number }) {
  const max = node.max && node.max > 0 ? node.max : 1;
  const frac = Math.max(0, Math.min(1, node.value / max));
  const track = color(doc, node.fill, "#E2E8F0");
  const bar = color(doc, node.barFill, PALETTE[0]);

  if (node.kind === "circular") {
    const sw = node.strokeWidth ?? Math.max(3, Math.min(w, h) * 0.12);
    const cx = w / 2,
      cy = h / 2;
    const r = Math.min(w, h) / 2 - sw;
    const c = 2 * Math.PI * r;
    const offset = c * (1 - frac);
    return (
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={track} strokeWidth={sw} />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={bar}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
        {node.label && (
          <text x={cx} y={cy + 4} textAnchor="middle" fontSize={Math.max(9, Math.min(w, h) * 0.22)} fill={bar} fontFamily="ui-sans-serif, system-ui">
            {Math.round(frac * 100)}%
          </text>
        )}
      </svg>
    );
  }

  // linear
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", gap: 4, justifyContent: "center" }}>
      <div style={{ width: "100%", height: Math.max(4, h - (node.label ? 14 : 0)), background: track, borderRadius: 999, overflow: "hidden" }}>
        <div style={{ width: `${frac * 100}%`, height: "100%", background: bar, borderRadius: 999 }} />
      </div>
      {node.label && (
        <span style={{ fontSize: 11, color: bar, fontFamily: "ui-sans-serif, system-ui" }}>{Math.round(frac * 100)}%</span>
      )}
    </div>
  );
}

export function SkeletonView({ doc, node }: { doc: Doc; node: SkeletonNode }) {
  const base = color(doc, node.fill, "#E2E8F0");
  const animated = node.animated !== false;
  const shimmer: CSSProperties = animated
    ? {
        background: `linear-gradient(90deg, ${base} 25%, #F1F5F9 50%, ${base} 75%)`,
        backgroundSize: "200% 100%",
        animation: "cd-skeleton-shimmer 1.4s ease-in-out infinite",
      }
    : { background: base };

  if (node.kind === "circle") {
    return <div style={{ width: "100%", height: "100%", borderRadius: "50%", ...shimmer }} />;
  }
  if (node.kind === "text") {
    const lines = node.lines ?? 3;
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", gap: 8, justifyContent: "center" }}>
        {Array.from({ length: lines }, (_, i) => (
          <div
            key={i}
            style={{
              height: 10,
              width: i === lines - 1 ? "60%" : "100%",
              borderRadius: 4,
              ...shimmer,
            }}
          />
        ))}
      </div>
    );
  }
  const rad = node.radius != null ? undefined : 6;
  return <div style={{ width: "100%", height: "100%", borderRadius: rad, ...shimmer }} />;
}
