import type { CSSProperties, ReactNode } from "react";
import {
  resolve,
  expandInstance,
  type Doc,
  type Node,
  type Layout,
  type Size,
  type Gradient,
  type Shadow,
  type ImageFill,
  type VideoFill,
  type Transform,
  type FillLayer,
  type Mask,
  type ClipPath,
  type Outline,
  type AvatarNode,
  type ProgressNode,
  type SkeletonNode,
  type FrameNode,
  type TextNode,
  type InstanceNode,
} from "@cursor-design/core";
import { IconSvg, ShapeSvg, ChartSvg, AvatarView, ProgressView, SkeletonView } from "./primitives";

const SVG_TYPES = new Set(["icon", "shape", "chart"]);
const WIDGET_TYPES = new Set(["avatar", "progress", "skeleton"]);
const DEFAULT_SIZE: Record<string, [number, number]> = {
  icon: [24, 24],
  shape: [48, 48],
  chart: [320, 200],
  avatar: [40, 40],
  progress: [200, 8],
  skeleton: [200, 16],
};

type BgLayer = { image: string; size: string; position: string; repeat: string };

function isVideoFill(layer: FillLayer): layer is VideoFill {
  return typeof layer === "object" && layer !== null && (layer as VideoFill).kind === "video";
}

function isImageFill(layer: FillLayer): layer is ImageFill {
  return typeof layer === "object" && layer !== null && (layer as ImageFill).kind === "image";
}

function isGradient(layer: FillLayer): layer is Gradient {
  return typeof layer === "object" && layer !== null && "kind" in layer && ["linear", "radial", "conic"].includes((layer as Gradient).kind);
}

function gradientCss(doc: Doc, g: Gradient): string {
  const stops = (g.stops ?? []).map((s) => `${String(resolve(doc, s.color))} ${Math.round((s.at ?? 0) * 100)}%`).join(", ");
  if (g.kind === "radial") return `radial-gradient(circle, ${stops})`;
  if (g.kind === "conic") return `conic-gradient(from ${g.angle ?? 0}deg, ${stops})`;
  return `linear-gradient(${g.angle ?? 180}deg, ${stops})`;
}

function layerToBg(doc: Doc, layer: FillLayer): BgLayer | { color: string } | null {
  if (typeof layer === "string") return { color: String(resolve(doc, layer)) };
  if (isVideoFill(layer)) return null; // rendered as <video>
  if (isImageFill(layer)) {
    const src = String(layer.src).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return {
      image: `url("${src}")`,
      size: layer.fit === "contain" ? "contain" : "cover",
      position: "center",
      repeat: "no-repeat",
    };
  }
  if (isGradient(layer)) {
    return { image: gradientCss(doc, layer), size: "auto", position: "0 0", repeat: "no-repeat" };
  }
  return null;
}

/** Split fill into CSS-able layers vs video layers (videos need DOM elements). */
function splitFill(fill: unknown): { css: FillLayer[]; videos: VideoFill[] } {
  const layers = (Array.isArray(fill) ? fill : fill != null ? [fill] : []) as FillLayer[];
  const css: FillLayer[] = [];
  const videos: VideoFill[] = [];
  for (const layer of layers) {
    if (isVideoFill(layer)) videos.push(layer);
    else css.push(layer);
  }
  return { css, videos };
}

/** Apply non-video fill layers to style. */
function applyFill(doc: Doc, layers: FillLayer[], s: CSSProperties) {
  if (!layers.length) return;
  if (layers.length === 1 && typeof layers[0] === "string") {
    s.backgroundColor = String(resolve(doc, layers[0]));
    return;
  }
  const images: string[] = [];
  const sizes: string[] = [];
  const positions: string[] = [];
  const repeats: string[] = [];
  for (const layer of layers) {
    const r = layerToBg(doc, layer);
    if (!r) continue;
    if ("color" in r) {
      images.push(`linear-gradient(${r.color}, ${r.color})`);
      sizes.push("auto");
      positions.push("0 0");
      repeats.push("no-repeat");
    } else {
      images.push(r.image);
      sizes.push(r.size);
      positions.push(r.position);
      repeats.push(r.repeat);
    }
  }
  if (!images.length) return;
  s.backgroundImage = images.join(", ");
  s.backgroundSize = sizes.join(", ");
  s.backgroundPosition = positions.join(", ");
  s.backgroundRepeat = repeats.join(", ");
}

function radiusToCss(doc: Doc, r: unknown): string | undefined {
  if (r == null) return undefined;
  if (Array.isArray(r)) return r.map((v) => `${resolve(doc, v)}px`).join(" ");
  return `${resolve(doc, r)}px`;
}

function shadowToCss(doc: Doc, sh: unknown): string[] {
  if (sh == null) return [];
  const resolved = typeof sh === "string" ? resolve(doc, sh) : sh;
  const arr = Array.isArray(resolved) ? resolved : [resolved];
  return arr.filter(Boolean).map((raw) => {
    const o = raw as Shadow;
    return `${o.inset ? "inset " : ""}${o.x}px ${o.y}px ${o.blur}px ${o.spread ?? 0}px ${String(resolve(doc, o.color))}`;
  });
}

function padCss(doc: Doc, p: unknown): string | undefined {
  if (p === undefined || p === null) return undefined;
  const r = resolve(doc, p);
  if (typeof r === "number") return `${r}px`;
  if (Array.isArray(r)) return r.map((v) => `${resolve(doc, v)}px`).join(" ");
  return undefined;
}

function transformCss(t: Transform | undefined): string | undefined {
  if (!t) return undefined;
  const parts: string[] = [];
  if (t.x != null || t.y != null) parts.push(`translate(${t.x ?? 0}px, ${t.y ?? 0}px)`);
  if (t.scale != null) parts.push(`scale(${t.scale})`);
  if (t.rotate != null) parts.push(`rotate(${t.rotate}deg)`);
  return parts.length ? parts.join(" ") : undefined;
}

function maskCss(doc: Doc, mask: Mask | undefined): string | undefined {
  if (!mask) return undefined;
  if (mask.kind === "image") {
    const src = String(mask.src).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `url("${src}")`;
  }
  const stops = mask.stops.map((s) => `${String(resolve(doc, s.color))} ${Math.round(s.at * 100)}%`).join(", ");
  if (mask.kind === "radial") return `radial-gradient(circle, ${stops})`;
  return `linear-gradient(${mask.angle ?? 180}deg, ${stops})`;
}

function clipPathCss(cp: ClipPath | undefined): string | undefined {
  if (!cp) return undefined;
  if (cp.kind === "inset") {
    const [t, r, b, l] = cp.args ?? [0, 0, 0, 0];
    return `inset(${t}% ${r}% ${b}% ${l}%)`;
  }
  if (cp.kind === "circle") {
    const r = cp.r ?? "50%";
    const cx = cp.cx ?? "50%";
    const cy = cp.cy ?? "50%";
    const rs = typeof r === "number" ? `${r}px` : r;
    const cxs = typeof cx === "number" ? `${cx}px` : cx;
    const cys = typeof cy === "number" ? `${cy}px` : cy;
    return `circle(${rs} at ${cxs} ${cys})`;
  }
  if (cp.kind === "ellipse") {
    const rx = cp.rx ?? "50%";
    const ry = cp.ry ?? "50%";
    const cx = cp.cx ?? "50%";
    const cy = cp.cy ?? "50%";
    const f = (v: number | string) => (typeof v === "number" ? `${v}px` : v);
    return `ellipse(${f(rx)} ${f(ry)} at ${f(cx)} ${f(cy)})`;
  }
  if (cp.kind === "polygon") return `polygon(${cp.points})`;
  return `path('${cp.d.replace(/'/g, "\\'")}')`;
}

function applyOutline(doc: Doc, outline: Outline | undefined, s: CSSProperties) {
  if (!outline) return;
  s.outline = `${outline.width}px solid ${String(resolve(doc, outline.color))}`;
  if (outline.offset != null) s.outlineOffset = `${outline.offset}px`;
}

function applyExpressiveness(doc: Doc, n: Node, s: CSSProperties) {
  if (n.blur !== undefined) {
    const blur = `${resolve(doc, n.blur)}px`;
    s.filter = s.filter ? `${s.filter} blur(${blur})` : `blur(${blur})`;
  }
  if (n.mixBlendMode) s.mixBlendMode = n.mixBlendMode;
  const mask = maskCss(doc, n.mask);
  if (mask) {
    s.maskImage = mask;
    (s as CSSProperties & { WebkitMaskImage?: string }).WebkitMaskImage = mask;
    s.maskSize = "cover";
    (s as CSSProperties & { WebkitMaskSize?: string }).WebkitMaskSize = "cover";
  }
  const cp = clipPathCss(n.clipPath);
  if (cp) s.clipPath = cp;
  applyOutline(doc, n.outline, s);
}

function VideoLayers({ videos }: { videos: VideoFill[] }) {
  if (!videos.length) return null;
  return (
    <>
      {videos.map((v, i) => (
        <video
          key={i}
          src={v.src}
          poster={v.poster}
          muted={v.muted !== false}
          loop={v.loop !== false}
          autoPlay
          playsInline
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: v.fit ?? "cover",
            zIndex: 0,
            pointerEvents: "none",
          }}
        />
      ))}
    </>
  );
}

type Props = {
  doc: Doc;
  id: string;
  parentLayout?: Layout;
  topLevel?: boolean;
  /** True when the parent frame uses layout.mode === "absolute". */
  absoluteChild?: boolean;
  /** Play mode: pin top-level frames at 0,0 inside the device chrome. */
  originZero?: boolean;
  /** Override `data-node-id` for hit-testing (instances expand to a virtual tree). */
  hitId?: string;
  selected: Set<string>;
  onPick: (id: string, e: React.MouseEvent) => void;
};

function sizeStyle(
  axis: "width" | "height",
  v: Size | undefined,
  parent: Layout | undefined,
  topLevel: boolean | undefined,
  absoluteChild: boolean | undefined,
  s: CSSProperties,
) {
  if (absoluteChild) {
    if (typeof v === "number") {
      s[axis] = v;
      return;
    }
    if (v === "fill") {
      s[axis] = "100%";
      return;
    }
    s[axis] = "fit-content";
    return;
  }
  const main = parent?.direction === "row" ? "width" : "height";
  if (typeof v === "number") {
    s[axis] = v;
    if (axis === main) s.flexShrink = 0;
    return;
  }
  if (v === "fill") {
    if (topLevel || !parent) {
      s[axis] = axis === "width" ? 390 : 400;
      return;
    }
    if (axis === main) {
      // `1 1 0%` so equal-fill siblings share free space evenly (0px basis
      // still lets content min-size win in some WebViews).
      s.flexGrow = 1;
      s.flexShrink = 1;
      s.flexBasis = "0%";
      if (axis === "width") s.minWidth = 0;
      else s.minHeight = 0;
    } else s.alignSelf = "stretch";
    return;
  }
  s[axis] = "fit-content";
  if (axis === main) s.flexShrink = 0;
}

const alignMap = { start: "flex-start", center: "center", end: "flex-end", stretch: "stretch" } as const;
const justifyMap: Record<string, string> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  "space-between": "space-between",
  space_between: "space-between", // common agent typo
};

function wrapWithVideos(style: CSSProperties, videos: VideoFill[], children: ReactNode, common: Record<string, unknown>) {
  const s = videos.length ? { ...style, overflow: style.overflow ?? "hidden" } : style;
  // Ensure positioning context for absolute <video> layers.
  if (videos.length && s.position !== "absolute" && s.position !== "fixed") s.position = "relative";
  return (
    <div {...common} style={s}>
      <VideoLayers videos={videos} />
      {children}
    </div>
  );
}

export function NodeView({ doc, id, parentLayout, topLevel, absoluteChild, originZero, hitId, selected, onPick }: Props) {
  const n = doc.nodes[id] as Node | undefined;
  if (!n || n.visible === false) return null;

  if (n.type === "instance") {
    const expanded = expandInstance(doc, n as InstanceNode);
    if (!expanded) {
      return (
        <div
          data-node-id={id}
          data-node-type="instance"
          className={`node node--instance${selected.has(id) ? " is-selected" : ""}`}
          onClick={(e) => onPick(id, e)}
          style={{
            boxSizing: "border-box",
            width: typeof n.width === "number" ? n.width : 120,
            height: typeof n.height === "number" ? n.height : 40,
            border: "1px dashed #f07167",
            display: "grid",
            placeItems: "center",
            color: "#f07167",
            fontSize: 11,
          }}
        >
          missing {(n as InstanceNode).component}
        </div>
      );
    }
    const shadowDoc: Doc = { ...doc, nodes: { ...doc.nodes, ...expanded.nodes } };
    return (
      <NodeView
        doc={shadowDoc}
        id={expanded.rootId}
        parentLayout={parentLayout}
        topLevel={topLevel}
        absoluteChild={absoluteChild}
        originZero={originZero}
        hitId={id}
        selected={selected}
        onPick={(_childId, e) => onPick(id, e)}
      />
    );
  }

  const positioned = !!(topLevel || absoluteChild);
  const s: CSSProperties = {
    boxSizing: "border-box",
    position: positioned ? "absolute" : "relative",
  };
  if (positioned) {
    s.left = topLevel && originZero ? 0 : (n.x ?? 0);
    s.top = topLevel && originZero ? 0 : (n.y ?? 0);
  }
  sizeStyle("width", n.width, parentLayout, topLevel, absoluteChild, s);
  sizeStyle("height", n.height, parentLayout, topLevel, absoluteChild, s);

  const { css: fillCss, videos } = n.type !== "text" && !SVG_TYPES.has(n.type) && !WIDGET_TYPES.has(n.type) ? splitFill(n.fill) : { css: [] as FillLayer[], videos: [] as VideoFill[] };
  if (fillCss.length) applyFill(doc, fillCss, s);

  const rad = radiusToCss(doc, n.radius);
  if (rad) s.borderRadius = rad;
  if (n.type === "ellipse") s.borderRadius = "50%";
  if (n.opacity !== undefined) s.opacity = n.opacity;
  if (n.zIndex !== undefined) s.zIndex = n.zIndex;
  if (n.backdropBlur !== undefined) {
    const blur = `${resolve(doc, n.backdropBlur)}px`;
    s.backdropFilter = `blur(${blur})`;
    (s as CSSProperties & { WebkitBackdropFilter?: string }).WebkitBackdropFilter = `blur(${blur})`;
  }
  const tf = transformCss(n.transform);
  if (tf) s.transform = tf;
  applyExpressiveness(doc, n, s);

  const shadows = shadowToCss(doc, n.shadow);
  if (n.stroke) shadows.unshift(`inset 0 0 0 ${n.stroke.width}px ${String(resolve(doc, n.stroke.color))}`);
  if (shadows.length) s.boxShadow = shadows.join(", ");

  const pickId = hitId ?? id;
  const common = {
    "data-node-id": pickId,
    "data-node-type": hitId ? "instance" : n.type,
    className: `node node--${hitId ? "instance" : n.type}${selected.has(pickId) ? " is-selected" : ""}`,
    onClick: (e: React.MouseEvent) => onPick(pickId, e),
  };

  if (n.type === "frame") {
    const frame = n as FrameNode;
    const l = frame.layout;
    const abs = l?.mode === "absolute";
    if (abs && !topLevel) s.position = "relative";
    if (l && !abs) {
      s.display = "flex";
      s.flexDirection = l.direction;
      if (l.gap !== undefined) s.gap = `${resolve(doc, l.gap)}px`;
      const p = padCss(doc, l.padding);
      if (p) s.padding = p;
      s.alignItems = alignMap[l.align ?? "start"];
      s.justifyContent = justifyMap[l.justify ?? "start"];
      if (l.wrap) s.flexWrap = "wrap";
    } else if (l?.padding) {
      const p = padCss(doc, l.padding);
      if (p) s.padding = p;
    }
    if (l?.margin !== undefined) {
      const m = padCss(doc, l.margin);
      if (m) s.margin = m;
    }
    if (frame.overflow) s.overflow = frame.overflow;
    else if (frame.clip) s.overflow = "hidden";
    if (videos.length && !s.overflow) s.overflow = "hidden";

    const kids = frame.children.map((c) => (
      <NodeView
        key={c}
        doc={doc}
        id={c}
        parentLayout={l}
        absoluteChild={abs}
        originZero={originZero}
        selected={selected}
        onPick={onPick}
      />
    ));
    return wrapWithVideos(s, videos, kids, common);
  }

  if (n.type === "text") {
    const tx = n as TextNode;
    const f = resolve(doc, tx.font ?? {}) as {
      family?: string;
      size?: number;
      weight?: number;
      lineHeight?: number;
      letterSpacing?: number;
      style?: string;
    };
    s.fontFamily = f.family ?? "system-ui, sans-serif";
    s.fontSize = f.size ?? 14;
    s.fontWeight = f.weight ?? 400;
    s.lineHeight = f.lineHeight ?? 1.25;
    if (f.letterSpacing != null) s.letterSpacing = `${f.letterSpacing}px`;
    if (f.style) s.fontStyle = f.style;
    if (tx.decoration) s.textDecoration = tx.decoration;
    if (tx.textTransform) s.textTransform = tx.textTransform;
    s.textAlign = tx.align ?? "left";
    s.whiteSpace = "pre-wrap";
    if (!s.margin) s.margin = 0;

    const fill = tx.fill;
    if (fill && typeof fill !== "string" && !Array.isArray(fill) && isGradient(fill as FillLayer)) {
      s.backgroundImage = gradientCss(doc, fill as Gradient);
      s.backgroundClip = "text";
      (s as CSSProperties & { WebkitBackgroundClip?: string }).WebkitBackgroundClip = "text";
      s.color = "transparent";
      (s as CSSProperties & { WebkitTextFillColor?: string }).WebkitTextFillColor = "transparent";
    } else if (typeof fill === "string") {
      s.color = String(resolve(doc, fill));
    } else {
      s.color = "inherit";
    }

    return (
      <p {...common} style={s}>
        {tx.content}
      </p>
    );
  }

  if (n.type === "image") {
    return <img {...common} style={{ ...s, objectFit: n.fit ?? "cover" }} src={n.src} alt={n.name ?? ""} />;
  }

  if (n.type === "avatar") {
    const size = n.size ?? (typeof n.width === "number" ? n.width : 40);
    if (typeof n.width !== "number") s.width = size;
    if (typeof n.height !== "number") s.height = size;
    return (
      <div {...common} style={s}>
        <AvatarView doc={doc} node={n as AvatarNode} />
      </div>
    );
  }

  if (n.type === "progress") {
    const [dw, dh] = n.kind === "circular" ? [48, 48] : DEFAULT_SIZE.progress;
    if (typeof n.width !== "number" && n.width !== "fill") s.width = dw;
    if (typeof n.height !== "number" && n.height !== "fill") s.height = n.kind === "circular" ? dh : dh;
    const w = typeof s.width === "number" ? s.width : dw;
    const h = typeof s.height === "number" ? s.height : dh;
    return (
      <div {...common} style={s}>
        <ProgressView doc={doc} node={n as ProgressNode} w={w} h={h} />
      </div>
    );
  }

  if (n.type === "skeleton") {
    const [dw, dh] = DEFAULT_SIZE.skeleton;
    if (typeof n.width !== "number" && n.width !== "fill") s.width = dw;
    if (typeof n.height !== "number" && n.height !== "fill") {
      s.height = n.kind === "text" ? (n.lines ?? 3) * 20 : n.kind === "circle" ? dw : dh;
    }
    return (
      <div {...common} style={s}>
        <SkeletonView doc={doc} node={n as SkeletonNode} />
      </div>
    );
  }

  if (SVG_TYPES.has(n.type)) {
    const [dw, dh] = DEFAULT_SIZE[n.type];
    if (typeof n.width !== "number" && n.width !== "fill") s.width = dw;
    if (typeof n.height !== "number" && n.height !== "fill") s.height = dh;
    s.lineHeight = 0;
    const w = typeof s.width === "number" ? s.width : dw;
    const h = typeof s.height === "number" ? s.height : dh;
    return (
      <div {...common} style={s}>
        {n.type === "icon" && <IconSvg doc={doc} node={n} />}
        {n.type === "shape" && <ShapeSvg doc={doc} node={n} />}
        {n.type === "chart" && <ChartSvg doc={doc} node={n} w={w} h={h} />}
      </div>
    );
  }

  // rect / ellipse with optional video fill
  if (videos.length) {
    return wrapWithVideos(s, videos, null, common);
  }
  return <div {...common} style={s} />;
}
