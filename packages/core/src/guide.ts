import { ICON_NAMES } from "./icons";

/** Always-on taste pack injected by `design_guide` (modes, bans, viz, explore, critique). */
export function tastePackMarkdown(): string {
  return `
## Taste pack (always apply)

Compressed design-thinking loop for this canvas: **brief → mode → tokens → build section → screenshot → inspect → fix**. Optional **explore** when the user wants alternatives. Full reference files live under the skill’s \`references/\` folder.

### Before every design_apply
1. One-line **design read**: subject · audience · **mode** · differentiator.
2. \`design_tokens { action: "list" }\` — prefer \`$token\` values; add a token before inventing hex/px.
3. **Structure first** — auto-layout frame (\`direction\`/\`gap\`/\`padding\`/\`align\`/\`justify\`) before coordinates; size with \`fill\`/\`hug\`/fixed. Absolute only for overlays. See \`references/layout.md\`.
4. Match existing screens’ naming and density when extending a file.

### Modes (pick one per frame)
| Mode | Use for | Craft |
|---|---|---|
| **persuade** | Landing, hero, promo | Bold POV, media, expressive type |
| **operate** | App, dashboard, settings, forms | Restraint, known patterns, dense-clear |
| **read** | Docs, empty states | Quiet chrome, strong hierarchy |
| **experience** | Immersive / cinematic | Image/video fills, glass, overlays |

**Refinement preserves; redesign replaces.** Brief wins over default taste.

### Hard bans (unless brief asks)
Purple→indigo / purple-on-white theme · cream+terracotta+serif cliché · broadsheet-as-default · identical card grids with soft gray shadows · Inter/Roboto/Arial as display personality when type tokens exist · nested cards · ALL-CAPS eyebrows everywhere · pure \`#000\`/\`#fff\` large fields · gray-on-color text · lorem ipsum · \`name: "frame"\`.

Spend boldness **once**. Restrained color (accent ≤~10%) is the Operate default.

### Data viz (don’t default to stock charts)
- KPI + trend → big number + \`sparkline\` (no axes)
- % complete / score → \`progress\` (linear/circular), not a fake donut
- Ranked list → label + linear \`progress\` rows
- True series needing scale → \`chart\` bar/line/area
- Heat / matrix → grid of frames with token fills (compose; allowed)
- Prefer small-multiple sparklines over one crowded multi-series line
- When using \`chart\`, prefer \`options.chrome:"minimal"\` + \`rounded\` / \`goal\` / \`highlight\` / \`valueLabels\` (not full Excel axes)

Use real \`chart\` nodes for series plots. **Do** compose gauges, ranks, and heat grids from frames/progress/text.

### Section loop
One coherent \`design_apply\` batch → \`design_screenshot\` on the frame → when layout looks off, \`design_inspect\` (bounds / overlaps / clipping / text-overflow) → fix → next section. Avoid “photo then navy band”; prefer image/layered fill + overlay copy.

### Explore (only when user wants options)
3 top-level frames, each with a **name + axis** (Quiet / Dense / Editorial…). Same tokens, real copy. Screenshot, present tradeoffs, **stop for the user’s pick**, then delete losers.

### Critique intents → ops
\`polish\` · \`quieter\` · \`bolder\` · \`distill\` · \`clarify\` · \`harden\` — selection → targeted updates → screenshot. Don’t redesign under polish.

### Overlays & motion (compose — no drawer/menu node)
**Never** invent \`drawer\` / \`modal\` / \`menu\` types. Compose + link:

| Pattern | Board | Link |
|---|---|---|
| Modal / sheet | Same-size frame: scrim (\`zIndex\` 1) + centered/bottom panel (\`zIndex\` 2) | Trigger: \`{ to, present:"overlay", transition:"fade" }\` |
| Drawer | Scrim + edge panel (\`x:0\` width ~280, height fill) | \`present:"overlay"\`, \`transition:"slide-left"\` (or slide-up) |
| Context menu | Small absolute panel near trigger (or sibling overlay frame) | Overlay + fade |
| Screen flow | Separate artboards | \`present:"navigate"\` (default), \`push\` / \`fade\` |

Dismiss: Back/Esc in Play, or a control with \`link:{ to:<baseFrameId>, present:"navigate" }\` (clears overlays when target is the current base).

**Motion tokens** (optional): \`motion.fast\` / \`motion.base\` as number ms (e.g. 180 / 240). Play uses CSS enter classes from \`link.transition\`; keep under ~300ms, ease-out. Prefer \`transform\` + \`opacity\` poses on the board for static mocks.

**Keyframe timelines** (\`doc.timelines\`): animate only \`opacity\` and transform channels (\`transform.x|y|scale|rotate\`) on nodes under a frame. Bound via \`frameId\`; autoplay in Play / browser preview when that frame is base or overlay.

\`\`\`
setTimeline { op:"setTimeline", id:"tl_hero", timeline:{
  id:"tl_hero", name?, frameId:"fr_home", duration:800, loop?,
  tracks:[{ nodeId:"tx_title", channel:"opacity"|"transform.x"|"transform.y"|"transform.scale"|"transform.rotate",
            keys:[{ t:0..1, value:number, ease?:"linear"|"ease-out"|"ease-in-out" }] }]
}}
setTimeline { op:"setTimeline", id:"tl_hero", timeline:null }  // delete
\`\`\`

Keys: \`t\` sorted in 0..1; values are absolute (opacity 0..1, x/y px, scale 1=100%, rotate degrees). Board edit mode shows rest pose; Play scrubber + Space toggles. Live browser: **Cursor Design: Open preview in browser** (hot-reloads on doc change).

Name layers clearly: \`Modal scrim\`, \`Drawer panel\`, \`Menu · Share\`.
`.trimStart();
}

/** Chart / shape / icon / widget catalog appended to SKILL.md for `design_guide` (no extra MCP tool). */
export function primitiveCatalogMarkdown(): string {
  return `
## High-level primitives (1c.2 + 1c.4)

### icon
\`{ type:"icon", name, fill?, strokeWidth?, width?, height? }\`
- \`name\` **must** be from the bundled list below (unknown names render as a dashed placeholder).
- \`fill\` is the stroke color (\`"$color.x"\` or hex). Default size 24×24.

### chart
\`{ type:"chart", width, height, chart:{ kind, labels?, series, options? } }\`
- \`kind\`: \`"bar"\` | \`"line"\` | \`"area"\` | \`"donut"\` | \`"sparkline"\`
- \`series\`: \`[{ name?, color?, values:number[] }]\` (at least one). Donut uses \`series[0].values\` as slices. Sparkline uses \`series[0]\` only (no axes).
- \`options\` (style polish):
  - \`chrome\`: \`"full"\` | \`"minimal"\` | \`"none"\` — prefer **minimal** on dashboards (category labels, no Y axis). Unspecified → minimal.
  - \`rounded\`: bar corner radius (\`true\` → 6)
  - \`strokeWidth\`, \`fillOpacity\`, \`showDots\`, \`fill\` (under-line / bar gradient)
  - \`valueLabels\`: \`true\` | \`"last"\`
  - \`goal\`: horizontal target line · \`highlight\`: dim other category indices · \`stacked\`: stack bar/area series
  - legacy \`axis\` / \`grid\` still work; \`chrome\` overrides density
- Use \`chart\` for true series plots. For gauges, ranks, KPI strips, and heat grids, **compose** with progress/text/frames (see Taste pack).

### shape
\`{ type:"shape", kind:"star"|"polygon"|"arrow"|"line"|"blob", sides?, innerRatio?, direction?, seed?, complexity?, fill?, stroke? }\`
- star/polygon default sides 5/6; arrow \`direction\` default \`"right"\`.
- \`line\`: \`direction\` \`"horizontal"\` | \`"vertical"\` (default horizontal).
- \`blob\`: organic path from \`seed\` + \`complexity\` (deterministic).

### avatar
\`{ type:"avatar", src?, initials?, size?, fill?, textFill?, ring?:{color,width}, radius? }\`
- Image (\`src\`) or initials fallback. Default size 40, circular. Optional \`ring\`.

### progress
\`{ type:"progress", kind:"linear"|"circular", value, max?, fill?, barFill?, strokeWidth?, label? }\`
- \`value\` is 0..1 (or 0..\`max\` when \`max\` set). Track = \`fill\`, completed = \`barFill\`. Prefer for gauges/ranks over stock bar charts.

### skeleton
\`{ type:"skeleton", kind:"rect"|"circle"|"text", lines?, fill?, animated?, radius? }\`
- Loading placeholders. \`text\` draws \`lines\` bars (default 3). \`animated\` shimmer (respects reduced motion).

### components / instances (1c.3)
- Promote a frame: \`design_components { action:"create", name, root }\` (or \`createComponent\` op) — detaches the master from the page.
- Place: \`design_components { action:"instantiate", id, parent, props }\` or \`create\` with \`type:"instance", component\`.
- Props use \`bind:"tx_label.content"\`; variants are overrides keyed by master node id (\`""\` = root).
- Restyle via master / props / variants — don’t rebuild. See \`references/components.md\`.

## Expressiveness (1c.4 — props on any node)

- **Layer blur** \`blur\` — CSS \`filter: blur()\`; distinct from \`backdropBlur\`.
- **Mix blend** \`mixBlendMode\` — CSS blend mode keyword.
- **Mask** \`mask\` — \`{ kind:"linear"|"radial", stops, angle? }\` or \`{ kind:"image", src }\`.
- **Clip path** \`clipPath\` — inset | circle | ellipse | polygon | path.
- **Outline** \`outline\` — \`{ color, width, offset? }\` (rings without fighting stroke).
- **Overflow** (frames) \`overflow\` — \`"visible"|"hidden"|"scroll"|"auto"\` (overrides boolean \`clip\` when set).
- **Conic gradient fill** \`{ kind:"conic", angle?, stops }\`.
- **Video fill** \`{ kind:"video", src, fit?, muted?, loop?, poster? }\` — use in layered fills with a scrim on top; parent should clip.
- **Typography** — text \`fill\` may be a gradient (gradient text); \`font.letterSpacing\`, \`font.style\`; \`decoration\`; \`textTransform\`.

## Available icon names (${ICON_NAMES.length})
${ICON_NAMES.join(", ")}
`.trimStart();
}

/** Append taste pack + primitive catalog to a SKILL.md body for MCP `design_guide`. */
export function withPrimitiveCatalog(skillMarkdown: string): string {
  return `${skillMarkdown.trimEnd()}\n\n${tastePackMarkdown()}\n\n${primitiveCatalogMarkdown()}\n`;
}
