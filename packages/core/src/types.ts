/** Design document — see PLAN.md §3.2. Flat, id-keyed, single-direction references. */

export type Id = string;

export type Size = number | "fill" | "hug";

export type TokenRef = `$${string}`;
export type ColorValue = string; // hex/rgba or "$token"

export type GradientStop = { color: ColorValue; at: number }; // at: 0..1
export type Gradient = { kind: "linear" | "radial" | "conic"; stops: GradientStop[]; angle?: number };
export type ImageFill = { kind: "image"; src: string; fit?: "cover" | "contain" };
export type VideoFill = {
  kind: "video";
  src: string;
  fit?: "cover" | "contain";
  muted?: boolean;
  loop?: boolean;
  poster?: string;
};
/** One paint layer: solid/token, gradient, image, or video. */
export type FillLayer = ColorValue | Gradient | ImageFill | VideoFill;
/** Single layer or top→bottom stack (CSS background order: first is topmost). */
export type Fill = FillLayer | FillLayer[];
export type Shadow = { x: number; y: number; blur: number; spread?: number; color: ColorValue; inset?: boolean };
/** A single value, a token ref, or per-corner [tl, tr, br, bl]. */
export type Radius = number | TokenRef | [number | TokenRef, number | TokenRef, number | TokenRef, number | TokenRef];
export type Transform = { x?: number; y?: number; scale?: number; rotate?: number };

export type MixBlendMode =
  | "normal"
  | "multiply"
  | "screen"
  | "overlay"
  | "darken"
  | "lighten"
  | "color-dodge"
  | "color-burn"
  | "hard-light"
  | "soft-light"
  | "difference"
  | "exclusion"
  | "hue"
  | "saturation"
  | "color"
  | "luminosity";

export type Mask =
  | { kind: "linear" | "radial"; stops: GradientStop[]; angle?: number }
  | { kind: "image"; src: string };

export type ClipPath =
  | { kind: "inset"; args?: [number, number, number, number] }
  | { kind: "circle"; r?: number | string; cx?: number | string; cy?: number | string }
  | { kind: "ellipse"; rx?: number | string; ry?: number | string; cx?: number | string; cy?: number | string }
  | { kind: "polygon"; points: string }
  | { kind: "path"; d: string };

export type Outline = { color: ColorValue; width: number; offset?: number };

export type Token =
  | { type: "color"; value: string; modes?: Record<string, string>; group?: string; description?: string }
  | { type: "number"; value: number; group?: string; description?: string }
  | { type: "string"; value: string; group?: string; description?: string }
  | {
      type: "font";
      family: string;
      size: number;
      weight?: number;
      lineHeight?: number;
      letterSpacing?: number;
      group?: string;
      description?: string;
    }
  | { type: "shadow"; value: Shadow | Shadow[]; group?: string; description?: string };

export type NumOrRef = number | TokenRef;
/** Spacing edge: number, token, or CSS `auto` (common for flex push / end-align). */
export type SpacingValue = NumOrRef | "auto";
export type Padding =
  | SpacingValue
  | [SpacingValue, SpacingValue]
  | [SpacingValue, SpacingValue, SpacingValue, SpacingValue];

export type Layout = {
  /** Default `"flex"`. `"absolute"` makes the frame a positioning context; children honor `x`/`y`. */
  mode?: "flex" | "absolute";
  direction: "row" | "column";
  gap?: number | TokenRef;
  padding?: Padding;
  /** CSS margin on this frame (negative allowed for flex overlap / peek stacks; `"auto"` allowed). */
  margin?: Padding;
  align?: "start" | "center" | "end" | "stretch";
  justify?: "start" | "center" | "end" | "space-between";
  wrap?: boolean;
};

export type Stroke = { color: ColorValue; width: number; align?: "inside" | "center" | "outside" };

/** Prototype link. Default `present` is navigate (replace screen). Use `overlay` for drawers/modals/menus. */
export type LinkTransition = "push" | "fade" | "instant" | "slide-up" | "slide-down" | "slide-left" | "slide-right";
export type LinkPresent = "navigate" | "overlay";
export type Link = { to: Id; transition?: LinkTransition; present?: LinkPresent };

export type InlineFont = {
  family?: string;
  size?: number;
  weight?: number;
  lineHeight?: number;
  letterSpacing?: number;
  style?: "normal" | "italic";
};

export type BaseNode = {
  id: Id;
  type: string;
  name?: string;
  visible?: boolean;
  /** Position on the page (top-level frames) or inside an absolute-layout parent. */
  x?: number;
  y?: number;
  width?: Size;
  height?: Size;
  fill?: Fill;
  stroke?: Stroke;
  radius?: Radius;
  /** Drop/inner shadow(s), inline or via a `$shadow.x` token. */
  shadow?: Shadow | Shadow[] | TokenRef;
  opacity?: number;
  /** Stacking within a positioned parent (absolute overlays). */
  zIndex?: number;
  /** CSS `backdrop-filter: blur(…)`; glass docks over imagery. */
  backdropBlur?: number | TokenRef;
  /** Whole-layer blur via CSS `filter` (distinct from backdropBlur). */
  blur?: number | TokenRef;
  mixBlendMode?: MixBlendMode;
  mask?: Mask;
  clipPath?: ClipPath;
  outline?: Outline;
  /** Translate / scale / rotate for peek slides and offset stacks. */
  transform?: Transform;
  link?: Link;
};

export type FrameNode = BaseNode & {
  type: "frame";
  layout?: Layout;
  clip?: boolean;
  /** When set, overrides boolean `clip` for CSS overflow. */
  overflow?: "visible" | "hidden" | "scroll" | "auto";
  children: Id[];
  /** Optional device preset shortcut; frames may be any size. */
  preset?: string;
};

export type RectNode = BaseNode & { type: "rect" };
export type EllipseNode = BaseNode & { type: "ellipse" };

export type TextNode = BaseNode & {
  type: "text";
  content: string;
  font?: TokenRef | InlineFont;
  align?: "left" | "center" | "right";
  decoration?: "none" | "underline" | "line-through";
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
};

export type ImageNode = BaseNode & { type: "image"; src: string; fit?: "cover" | "contain" };

/** Icon from the bundled set (see ICON_NAMES). `fill` is the stroke color. */
export type IconNode = BaseNode & { type: "icon"; name: string; strokeWidth?: number };

export type ChartSeries = { name?: string; color?: ColorValue; values: number[] };
/** Visual polish for charts (1c.5). `chrome` controls axes/grid density. */
export type ChartOptions = {
  axis?: boolean;
  grid?: boolean;
  legend?: boolean;
  max?: number;
  /** Sparkline/area under-fill; also enables soft gradient under area/line when true. */
  fill?: boolean;
  /** full = classic axes; minimal = category labels only; none = bare marks. Default: derive from axis/grid. */
  chrome?: "full" | "minimal" | "none";
  /** Bar corner radius (true → 6). */
  rounded?: boolean | number;
  /** Line/area/sparkline stroke width (default 2). */
  strokeWidth?: number;
  /** Area / sparkline fill opacity (default ~0.15–0.2). */
  fillOpacity?: number;
  /** Show point dots on line/area (default true for line, false when chrome is none). */
  showDots?: boolean;
  /** Label values on bars/points; `"last"` = only the final point per series. */
  valueLabels?: boolean | "last";
  /** Horizontal goal / target line at this value. */
  goal?: number;
  /** Emphasize this category index (0-based); others dim. */
  highlight?: number;
  /** Stack series for bar/area instead of grouping. */
  stacked?: boolean;
};
export type ChartSpec = {
  kind: "bar" | "line" | "area" | "donut" | "sparkline";
  labels?: string[];
  series: ChartSeries[];
  options?: ChartOptions;
};
export type ChartNode = BaseNode & { type: "chart"; chart: ChartSpec };

/** Parametric vector shape compiled to an SVG path. `fill`/`stroke` apply. */
export type ShapeNode = BaseNode & {
  type: "shape";
  kind: "star" | "polygon" | "arrow" | "line" | "blob";
  sides?: number; // polygon sides / star points (default 5)
  innerRatio?: number; // star inner radius ratio (default 0.5)
  direction?: "up" | "down" | "left" | "right" | "horizontal" | "vertical"; // arrow / line
  seed?: number; // blob
  complexity?: number; // blob point count hint
};

/** Circular / rounded avatar with image or initials. */
export type AvatarNode = BaseNode & {
  type: "avatar";
  src?: string;
  initials?: string;
  size?: number;
  textFill?: ColorValue;
  ring?: { color: ColorValue; width: number };
};

/** Determinate progress: linear bar or circular arc. `value` is 0..1 (or 0..max). */
export type ProgressNode = BaseNode & {
  type: "progress";
  kind: "linear" | "circular";
  value: number;
  max?: number;
  barFill?: ColorValue;
  strokeWidth?: number;
  label?: boolean;
};

/** Loading placeholder blocks. */
export type SkeletonNode = BaseNode & {
  type: "skeleton";
  kind: "rect" | "circle" | "text";
  lines?: number;
  animated?: boolean;
};

/** Prop on a component definition. `bind` targets a master node field, e.g. `tx_label.content`. */
export type ComponentPropDef = {
  type: "string" | "number" | "boolean" | "enum";
  default?: string | number | boolean;
  values?: string[];
  bind?: string;
};

/**
 * Reusable component. Master tree (`root` frame + descendants) lives in `nodes` but is not
 * listed on any page — instances reference it and expand at render time.
 */
export type ComponentDef = {
  id: Id;
  name: string;
  root: Id;
  props?: Record<string, ComponentPropDef>;
  /**
   * Variant name → overrides keyed by master node id (`""` / `"root"` = component root).
   * Selected via `props[variantProp]` (default prop name `"variant"`).
   */
  variants?: Record<string, Record<string, Record<string, unknown>>>;
  variantProp?: string;
  description?: string;
};

/** Placed reference to a component. Shell props (size, link, …) apply to the expanded root. */
export type InstanceNode = BaseNode & {
  type: "instance";
  component: Id;
  props?: Record<string, string | number | boolean>;
  /** Overrides keyed by master node id. */
  overrides?: Record<string, Record<string, unknown>>;
};

export type Node =
  | FrameNode
  | RectNode
  | EllipseNode
  | TextNode
  | ImageNode
  | IconNode
  | ChartNode
  | ShapeNode
  | AvatarNode
  | ProgressNode
  | SkeletonNode
  | InstanceNode;
export type NodeType = Node["type"];

export type Page = { name: string; frames: Id[] };
export type Folder = { name: string; children: Id[] };

export type Annotation = {
  nodeId: Id;
  anchor?: { x: number; y: number };
  body: string;
  status: "open" | "sent" | "resolved";
  createdAt?: string;
};

/** Channels a timeline may animate (v1: transform + opacity only). */
export type TimelineChannel =
  | "opacity"
  | "transform.x"
  | "transform.y"
  | "transform.scale"
  | "transform.rotate";

export type TimelineEase = "linear" | "ease-out" | "ease-in-out";

export type TimelineKey = {
  /** Normalized time 0..1 along the timeline. */
  t: number;
  value: number;
  ease?: TimelineEase;
};

export type TimelineTrack = {
  nodeId: Id;
  channel: TimelineChannel;
  keys: TimelineKey[];
};

export type Timeline = {
  id: Id;
  name?: string;
  /** Frame this timeline is bound to (plays when that frame is shown in Play). */
  frameId: Id;
  /** Duration in milliseconds. */
  duration: number;
  loop?: boolean;
  tracks: TimelineTrack[];
};

/** Per-node motion sample from timeline interpolation. */
export type MotionSample = {
  opacity?: number;
  transform?: Transform;
};

export type Doc = {
  schemaVersion: 1;
  name: string;
  tokens: Record<string, Token>;
  folderRoot: Id[];
  folders: Record<Id, Folder>;
  pages: Record<Id, Page>;
  nodes: Record<Id, Node>;
  /** Component definitions (masters referenced by `root`). */
  components?: Record<Id, ComponentDef>;
  annotations?: Record<Id, Annotation>;
  /** Keyframe timelines bound to frames (transform/opacity). */
  timelines?: Record<Id, Timeline>;
};
