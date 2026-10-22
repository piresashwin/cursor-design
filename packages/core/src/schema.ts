import { z } from "zod";

const tokenRef = z.string().regex(/^\$[\w.-]+$/, "token ref like $color.bg");
const size = z.union([z.number(), z.literal("fill"), z.literal("hug")]);
const color = z.string();

const GradientStopSchema = z.object({ color, at: z.number().min(0).max(1) });
const GradientSchema = z.object({
  kind: z.enum(["linear", "radial", "conic"]),
  stops: z.array(GradientStopSchema).min(2),
  angle: z.number().optional(),
});
const ImageFillSchema = z.object({
  kind: z.literal("image"),
  src: z.string().min(1),
  fit: z.enum(["cover", "contain"]).optional(),
});
const VideoFillSchema = z.object({
  kind: z.literal("video"),
  src: z.string().min(1),
  fit: z.enum(["cover", "contain"]).optional(),
  muted: z.boolean().optional(),
  loop: z.boolean().optional(),
  poster: z.string().optional(),
});
const FillLayerSchema = z.union([color, GradientSchema, ImageFillSchema, VideoFillSchema]);
const fill = z.union([FillLayerSchema, z.array(FillLayerSchema).min(1)]);
const ShadowSchema = z.object({
  x: z.number(),
  y: z.number(),
  blur: z.number().min(0),
  spread: z.number().optional(),
  color,
  inset: z.boolean().optional(),
});
const shadow = z.union([ShadowSchema, z.array(ShadowSchema), tokenRef]);
const radius = z.union([z.number(), tokenRef, z.tuple([
  z.union([z.number(), tokenRef]), z.union([z.number(), tokenRef]), z.union([z.number(), tokenRef]), z.union([z.number(), tokenRef]),
])]);
const TransformSchema = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
  scale: z.number().optional(),
  rotate: z.number().optional(),
});

const MixBlendModeSchema = z.enum([
  "normal",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "color-dodge",
  "color-burn",
  "hard-light",
  "soft-light",
  "difference",
  "exclusion",
  "hue",
  "saturation",
  "color",
  "luminosity",
]);

const MaskSchema = z.union([
  z.object({
    kind: z.enum(["linear", "radial"]),
    stops: z.array(GradientStopSchema).min(2),
    angle: z.number().optional(),
  }),
  z.object({ kind: z.literal("image"), src: z.string().min(1) }),
]);

const ClipPathSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("inset"),
    args: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
  }),
  z.object({
    kind: z.literal("circle"),
    r: z.union([z.number(), z.string()]).optional(),
    cx: z.union([z.number(), z.string()]).optional(),
    cy: z.union([z.number(), z.string()]).optional(),
  }),
  z.object({
    kind: z.literal("ellipse"),
    rx: z.union([z.number(), z.string()]).optional(),
    ry: z.union([z.number(), z.string()]).optional(),
    cx: z.union([z.number(), z.string()]).optional(),
    cy: z.union([z.number(), z.string()]).optional(),
  }),
  z.object({ kind: z.literal("polygon"), points: z.string().min(1) }),
  z.object({ kind: z.literal("path"), d: z.string().min(1) }),
]);

const OutlineSchema = z.object({
  color,
  width: z.number().min(0),
  offset: z.number().optional(),
});

export const TokenSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("color"),
    value: z.string(),
    modes: z.record(z.string()).optional(),
    group: z.string().optional(),
    description: z.string().optional(),
  }),
  z.object({ type: z.literal("number"), value: z.number(), group: z.string().optional(), description: z.string().optional() }),
  z.object({ type: z.literal("string"), value: z.string(), group: z.string().optional(), description: z.string().optional() }),
  z.object({
    type: z.literal("font"),
    family: z.string(),
    size: z.number(),
    weight: z.number().optional(),
    lineHeight: z.number().optional(),
    letterSpacing: z.number().optional(),
    group: z.string().optional(),
    description: z.string().optional(),
  }),
  z.object({
    type: z.literal("shadow"),
    value: z.union([ShadowSchema, z.array(ShadowSchema)]),
    group: z.string().optional(),
    description: z.string().optional(),
  }),
]);

const numOrRef = z.union([z.number(), tokenRef]);
/** Padding/margin edge: number, `$token`, or CSS `auto`. */
const spacingValue = z.union([numOrRef, z.literal("auto")]);
const padding = z.union([
  spacingValue,
  z.tuple([spacingValue, spacingValue]),
  z.tuple([spacingValue, spacingValue, spacingValue, spacingValue]),
]);

export const LayoutSchema = z.object({
  mode: z.enum(["flex", "absolute"]).optional(),
  direction: z.enum(["row", "column"]),
  gap: z.union([z.number(), tokenRef]).optional(),
  padding: padding.optional(),
  margin: padding.optional(), // negatives + "auto" allowed
  align: z.enum(["start", "center", "end", "stretch"]).optional(),
  // Agents often emit space_between; normalize to CSS/flex space-between.
  justify: z.preprocess(
    (v) => (v === "space_between" ? "space-between" : v),
    z.enum(["start", "center", "end", "space-between"]).optional(),
  ),
  wrap: z.boolean().optional(),
});

const base = {
  id: z.string().min(1),
  name: z.string().optional(),
  visible: z.boolean().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  width: size.optional(),
  height: size.optional(),
  fill: fill.optional(),
  stroke: z.object({ color, width: z.number(), align: z.enum(["inside", "center", "outside"]).optional() }).optional(),
  radius: radius.optional(),
  shadow: shadow.optional(),
  opacity: z.number().min(0).max(1).optional(),
  zIndex: z.number().optional(),
  backdropBlur: numOrRef.optional(),
  blur: numOrRef.optional(),
  mixBlendMode: MixBlendModeSchema.optional(),
  mask: MaskSchema.optional(),
  clipPath: ClipPathSchema.optional(),
  outline: OutlineSchema.optional(),
  transform: TransformSchema.optional(),
  link: z
    .object({
      to: z.string(),
      transition: z
        .enum(["push", "fade", "instant", "slide-up", "slide-down", "slide-left", "slide-right"])
        .optional(),
      /** `navigate` (default) replaces the screen; `overlay` stacks the target on the current frame. */
      present: z.enum(["navigate", "overlay"]).optional(),
    })
    .optional(),
};

export const NodeSchema = z.discriminatedUnion("type", [
  z.object({
    ...base,
    type: z.literal("frame"),
    layout: LayoutSchema.optional(),
    clip: z.boolean().optional(),
    overflow: z.enum(["visible", "hidden", "scroll", "auto"]).optional(),
    // Agents often omit empty children on leaf frames (e.g. heat cells); default so docs still open.
    children: z.array(z.string()).default([]),
    preset: z.string().optional(),
  }),
  z.object({ ...base, type: z.literal("rect") }),
  z.object({ ...base, type: z.literal("ellipse") }),
  z.object({
    ...base,
    type: z.literal("text"),
    content: z.string(),
    font: z
      .union([
        tokenRef,
        z.object({
          family: z.string().optional(),
          size: z.number().optional(),
          weight: z.number().optional(),
          lineHeight: z.number().optional(),
          letterSpacing: z.number().optional(),
          style: z.enum(["normal", "italic"]).optional(),
        }),
      ])
      .optional(),
    align: z.enum(["left", "center", "right"]).optional(),
    decoration: z.enum(["none", "underline", "line-through"]).optional(),
    textTransform: z.enum(["none", "uppercase", "lowercase", "capitalize"]).optional(),
  }),
  z.object({ ...base, type: z.literal("image"), src: z.string(), fit: z.enum(["cover", "contain"]).optional() }),
  z.object({ ...base, type: z.literal("icon"), name: z.string(), strokeWidth: z.number().optional() }),
  z.object({
    ...base,
    type: z.literal("chart"),
    chart: z.object({
      kind: z.enum(["bar", "line", "area", "donut", "sparkline"]),
      labels: z.array(z.string()).optional(),
      series: z.array(z.object({ name: z.string().optional(), color: color.optional(), values: z.array(z.number()) })).min(1),
      options: z
        .object({
          axis: z.boolean().optional(),
          grid: z.boolean().optional(),
          legend: z.boolean().optional(),
          max: z.number().optional(),
          fill: z.boolean().optional(),
          chrome: z.enum(["full", "minimal", "none"]).optional(),
          rounded: z.union([z.boolean(), z.number().min(0)]).optional(),
          strokeWidth: z.number().min(0).optional(),
          fillOpacity: z.number().min(0).max(1).optional(),
          showDots: z.boolean().optional(),
          valueLabels: z.union([z.boolean(), z.literal("last")]).optional(),
          goal: z.number().optional(),
          highlight: z.number().int().min(0).optional(),
          stacked: z.boolean().optional(),
        })
        .optional(),
    }),
  }),
  z.object({
    ...base,
    type: z.literal("shape"),
    kind: z.enum(["star", "polygon", "arrow", "line", "blob"]),
    sides: z.number().optional(),
    innerRatio: z.number().optional(),
    direction: z.enum(["up", "down", "left", "right", "horizontal", "vertical"]).optional(),
    seed: z.number().optional(),
    complexity: z.number().optional(),
  }),
  z.object({
    ...base,
    type: z.literal("avatar"),
    src: z.string().optional(),
    initials: z.string().optional(),
    size: z.number().optional(),
    textFill: color.optional(),
    ring: z.object({ color, width: z.number().min(0) }).optional(),
  }),
  z.object({
    ...base,
    type: z.literal("progress"),
    kind: z.enum(["linear", "circular"]),
    value: z.number(),
    max: z.number().optional(),
    barFill: color.optional(),
    strokeWidth: z.number().optional(),
    label: z.boolean().optional(),
  }),
  z.object({
    ...base,
    type: z.literal("skeleton"),
    kind: z.enum(["rect", "circle", "text"]),
    lines: z.number().int().min(1).max(12).optional(),
    animated: z.boolean().optional(),
  }),
  z.object({
    ...base,
    type: z.literal("instance"),
    component: z.string(),
    props: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
    overrides: z.record(z.record(z.any())).optional(),
  }),
]);

export const ComponentPropDefSchema = z.object({
  type: z.enum(["string", "number", "boolean", "enum"]),
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
  values: z.array(z.string()).optional(),
  bind: z.string().optional(),
});

export const ComponentDefSchema = z.object({
  id: z.string(),
  name: z.string(),
  root: z.string(),
  props: z.record(ComponentPropDefSchema).optional(),
  variants: z.record(z.record(z.record(z.any()))).optional(),
  variantProp: z.string().optional(),
  description: z.string().optional(),
});

export const AnnotationSchema = z.object({
  nodeId: z.string(),
  anchor: z.object({ x: z.number(), y: z.number() }).optional(),
  body: z.string(),
  status: z.enum(["open", "sent", "resolved"]),
  createdAt: z.string().optional(),
});

export const TimelineChannelSchema = z.enum([
  "opacity",
  "transform.x",
  "transform.y",
  "transform.scale",
  "transform.rotate",
]);

export const TimelineKeySchema = z.object({
  t: z.number().min(0).max(1),
  value: z.number(),
  ease: z.enum(["linear", "ease-out", "ease-in-out"]).optional(),
});

export const TimelineTrackSchema = z.object({
  nodeId: z.string().min(1),
  channel: TimelineChannelSchema,
  keys: z.array(TimelineKeySchema).min(1),
});

export const TimelineSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  frameId: z.string().min(1),
  duration: z.number().positive(),
  loop: z.boolean().optional(),
  tracks: z.array(TimelineTrackSchema),
});

export const DocSchema = z.object({
  schemaVersion: z.literal(1),
  name: z.string(),
  tokens: z.record(TokenSchema),
  folderRoot: z.array(z.string()),
  folders: z.record(z.object({ name: z.string(), children: z.array(z.string()) })),
  pages: z.record(z.object({ name: z.string(), frames: z.array(z.string()) })),
  nodes: z.record(NodeSchema),
  components: z.record(ComponentDefSchema).optional(),
  annotations: z.record(AnnotationSchema).optional(),
  timelines: z.record(TimelineSchema).optional(),
});

export const OpSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("create"), node: z.record(z.any()).and(z.object({ type: z.string() })), parent: z.string(), index: z.number().optional() }),
  z.object({ op: z.literal("update"), id: z.string(), set: z.record(z.any()).optional(), unset: z.array(z.string()).optional() }),
  z.object({ op: z.literal("move"), id: z.string(), parent: z.string(), index: z.number().optional() }),
  z.object({ op: z.literal("delete"), ids: z.array(z.string()) }),
  z.object({ op: z.literal("createFrame"), frame: z.record(z.any()), page: z.string(), index: z.number().optional() }),
  z.object({ op: z.literal("moveFrame"), id: z.string(), page: z.string(), index: z.number().optional() }),
  z.object({ op: z.literal("createPage"), id: z.string().optional(), name: z.string(), folder: z.string().nullable(), index: z.number().optional() }),
  z.object({ op: z.literal("renamePage"), id: z.string(), name: z.string() }),
  z.object({ op: z.literal("movePage"), id: z.string(), folder: z.string().nullable(), index: z.number().optional() }),
  z.object({ op: z.literal("deletePage"), id: z.string(), moveFramesTo: z.string().optional() }),
  z.object({ op: z.literal("createFolder"), id: z.string().optional(), name: z.string(), parent: z.string().nullable(), index: z.number().optional() }),
  z.object({ op: z.literal("renameFolder"), id: z.string(), name: z.string() }),
  z.object({ op: z.literal("moveFolder"), id: z.string(), parent: z.string().nullable(), index: z.number().optional() }),
  z.object({ op: z.literal("deleteFolder"), id: z.string(), moveChildrenTo: z.string().nullable().optional() }),
  z.object({ op: z.literal("setToken"), name: z.string(), token: TokenSchema.nullable() }),
  z.object({ op: z.literal("upsertAnnotation"), id: z.string().optional(), annotation: AnnotationSchema }),
  z.object({ op: z.literal("deleteAnnotation"), ids: z.array(z.string()) }),
  /** Promote an existing frame (and subtree) into a component master; detaches it from the page. */
  z.object({
    op: z.literal("createComponent"),
    id: z.string().optional(),
    name: z.string(),
    root: z.string(),
    props: z.record(ComponentPropDefSchema).optional(),
    variants: z.record(z.record(z.record(z.any()))).optional(),
    variantProp: z.string().optional(),
    description: z.string().optional(),
  }),
  /** Create/update/delete a component definition (`component: null` deletes). */
  z.object({ op: z.literal("setComponent"), id: z.string(), component: ComponentDefSchema.nullable() }),
  /** Create/update/delete a timeline (`timeline: null` deletes). */
  z.object({ op: z.literal("setTimeline"), id: z.string(), timeline: TimelineSchema.nullable() }),
]);

export type Op = z.infer<typeof OpSchema>;

/** JSON-schema-ish description of ops for the agent guide. */
export const OP_DOCS = `
create          { op:"create", node:{type,...}, parent:<frameId>, index? }      // node inside a frame
update          { op:"update", id, set:{...}, unset?:[keys] }
move            { op:"move", id, parent:<frameId>, index? }                      // reparent within/between frames
delete          { op:"delete", ids:[...] }
createFrame     { op:"createFrame", frame:{name,width,height,layout,...}, page:<pageId>, index? }
moveFrame       { op:"moveFrame", id, page:<pageId>, index? }
createPage      { op:"createPage", id?, name, folder:<folderId|null>, index? }
renamePage      { op:"renamePage", id, name }
movePage        { op:"movePage", id, folder:<folderId|null>, index? }
deletePage      { op:"deletePage", id, moveFramesTo?:<pageId> }
createFolder    { op:"createFolder", id?, name, parent:<folderId|null>, index? }
renameFolder    { op:"renameFolder", id, name }
moveFolder      { op:"moveFolder", id, parent:<folderId|null>, index? }
deleteFolder    { op:"deleteFolder", id, moveChildrenTo?:<folderId|null> }
setToken        { op:"setToken", name, token:<Token|null> }
upsertAnnotation{ op:"upsertAnnotation", id?, annotation:{nodeId, body, status} }
deleteAnnotation{ op:"deleteAnnotation", ids:[...] }
createComponent { op:"createComponent", id?, name, root:<frameId>, props?, variants? }  // detach frame → component
setComponent    { op:"setComponent", id, component:<ComponentDef|null> }               // update/delete def
setTimeline     { op:"setTimeline", id, timeline:<Timeline|null> }                     // keyframe motion on a frame
`.trim();
