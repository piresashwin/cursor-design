---
name: cursor-design
description: Build and edit UI prototypes on the Cursor Design canvas (*.design.json) through the design_* MCP tools. Use when the user asks to design, mock up, prototype, or lay out screens, components, or a design system.
---

# Cursor Design — agent guide

You edit a design document (`*.design.json`) that the user sees live in the Cursor Design editor. **Never edit the JSON file by hand** — always use the `design_*` MCP tools so the editor, undo history and validation stay in sync.

## Workflow (every time)

Compressed design loop: **brief → mode → tokens → section batch → screenshot → inspect → fix**.

1. One-line **design read** (subject · audience · **mode** · differentiator). Modes: `persuade` | `operate` | `read` | `experience` — see Taste pack in `design_guide` / `references/modes.md`.
2. `design_list` → find the file, its pages and frames. If none exists, ask the user to run **Cursor Design: New design file**, or create one.
3. `design_tokens { action: "list" }` → learn the design system. **Use `$token` references**. Only invent raw values when no token fits — prefer `batchSet` first.
4. `design_get` (summary) or `design_get { nodeId }` (subtree) → understand existing structure before changing it.
5. `design_apply { ops: [...] }` → **one batch per section** (atomic). **Structure first** (auto-layout containers, fill/hug/fixed) — see `references/layout.md`. **Every node needs a readable `name`**.
6. `design_screenshot { nodeId: <frameId> }` → **always verify** after a batch.
7. `design_inspect { nodeId: <frameId> }` → when spacing/overlap/clipping looks wrong; fix from `issues`, then screenshot again.
8. Open annotations → address and `upsertAnnotation` with `status: "resolved"`.

**Call `design_guide` once per session** — it injects the Taste pack (bans, viz, layout, explore, critique) plus the primitive catalog.

**Starting a new design system?** Tokens first: `batchSet` `color.*`, `space.*`, `radius.*`, `type.*` (optional `modes.dark`). Then build screens on those tokens.

**User wants options?** Follow `references/explore.md`: 3 named-axis frames → screenshot → stop for pick → delete losers.

**User says polish / quieter / bolder / distill?** Follow `references/critique.md` — targeted updates, not a redesign.

## Document model

```
folderRoot → folders[id].children (folder ids + page ids) → pages[id].frames (top-level frame ids) → nodes[id].children
```
Single-direction references only. The board shows **one page at a time**; frames are artboards of any size (390×844 phone, 1280×800 desktop, 600×800 email, …). `preset` is only a hint.

### Nodes (`nodes[id]`)
- Common: `id`, `type`, `name`, `x`,`y` (top-level frames **or** children of an absolute frame), `width`/`height`: number | `"fill"` | `"hug"`, `fill`, `stroke {color,width}`, `radius`, `shadow`, `opacity`, `zIndex`, `backdropBlur`, `transform {x?,y?,scale?,rotate?}`, `link {to:<frameId>, transition?, present?}`.
- **`link`**: `transition` = `push` | `fade` | `instant` | `slide-up` | `slide-down` | `slide-left` | `slide-right`. `present` = `navigate` (default, replace screen) | `overlay` (stack target on current frame — drawers/modals/menus). See `references/overlays.md`.
- **`fill`** is a color (`"#111"` or `"$color.x"`), a **gradient** `{ kind:"linear"|"radial"|"conic", angle?, stops:[{color, at:0..1}, …] }`, an **image** `{ kind:"image", src, fit? }`, a **video** `{ kind:"video", src, fit?, muted?, loop?, poster? }`, or a **layered array** `[topLayer, …, bottomLayer]` (scrim over image/video).
- **`radius`** is a number, a `"$radius.x"` ref, or per-corner `[tl, tr, br, bl]` (numbers or refs).
- **`shadow`** is `{x, y, blur, spread?, color, inset?}`, an array of them, or a `"$shadow.x"` ref. Use soft shadows for depth: e.g. `{x:0, y:8, blur:24, spread:-4, color:"rgba(16,24,40,.12)"}`.
- **Expressiveness (any node):** `blur` (layer filter), `mixBlendMode`, `mask`, `clipPath`, `outline:{color,width,offset?}`; frames also `overflow` (overrides `clip` when set).
- `frame`: `layout { mode?:"flex"|"absolute", direction:"row"|"column", gap, padding, margin (negatives OK), align, justify }`, `clip` / `overflow`, `children: [ids]`. **Default layout is flex**. Frames are the only containers (buttons, cards, inputs are frames with text inside).
- `text`: `content`, `font` (`"$type.body"` or `{family,size,weight,lineHeight,letterSpacing,style}`), `fill` = color **or gradient** (gradient text), `align`, `decoration`, `textTransform`.
- `rect`, `ellipse`, `image { src, fit }` (sibling image node; prefer **image fill** on a clipped frame for heroes).
- `icon`: `{ type:"icon", name, fill?, strokeWidth? }` — Lucide id from catalog (`design_guide`); `fill` is stroke color.
- `chart`: `{ type:"chart", chart:{ kind:"bar"|"line"|"area"|"donut"|"sparkline", labels?, series, options? } }`. Prefer `options.chrome:"minimal"`, `rounded`, `goal`, `highlight`, `valueLabels`, `stacked`. Use for true series; compose gauges/ranks/heat — see `references/viz.md`.
- `shape`: `{ type:"shape", kind:"star"|"polygon"|"arrow"|"line"|"blob", sides?, innerRatio?, direction?, seed?, complexity? }`.
- `avatar`: `{ type:"avatar", src?, initials?, size?, fill?, textFill?, ring?:{color,width} }` — image or initials.
- `progress`: `{ type:"progress", kind:"linear"|"circular", value, max?, fill?, barFill?, strokeWidth?, label? }` — `value` is 0..1 (or 0..max).
- `skeleton`: `{ type:"skeleton", kind:"rect"|"circle"|"text", lines?, fill?, animated? }` — loading placeholders.
- `instance`: `{ type:"instance", component:<cpId>, props?, overrides?, width?, height?, link? }` — placed component. Masters live in `components` (see `references/components.md`). Use `design_components` to list/create/instantiate.

Sizing rules of thumb: a top-level frame has numeric width/height. Children in a column: `width:"fill", height:"hug"` for text/rows; `height:"fill"` for a spacer that pushes content apart. Buttons: frame `height: 48, radius: "$radius.md", layout:{direction:"row", align:"center", justify:"center"}` with a text child. Absolute children: prefer numeric `width`/`height` (or `"fill"` = 100% of the parent).

### Composition (overlays / cinematic cards)
Prefer **flex**. Use **absolute** only for overlays / free placement inside a clipped card. Pattern:

1. Clipped frame (`clip:true`, radius, optional shadow) with `layout:{ mode:"absolute", direction:"column" }`
2. Image as **fill** (`{ kind:"image", src, fit:"cover" }`) — or layered `[scrimGradient, imageFill]`
3. Optional absolute scrim rect (`x:0,y:0,width:"fill",height:"fill", zIndex:1`, gradient fill) if not using layered fill
4. Absolute copy / CTAs with `x`/`y`/`zIndex` ≥ 2

Glass docks: `backdropBlur` + translucent fill over imagery. Peek stacks: `transform` and/or negative `layout.margin` on flex children. **Never** invent a carousel node — compose peeks from absolute + transform.

### Popups / drawers / menus (compose + overlay links)
**Do not** add `drawer` / `modal` / `menu` node types. Same size as the host screen:

1. Overlay artboard (`layout.mode:"absolute"`) with translucent **scrim** (`zIndex:1`) + **panel** (`zIndex:2`)
2. Trigger control: `link: { to: "fr_drawer", present: "overlay", transition: "slide-left" }` (modal → `fade`)
3. Dismiss: Play Back/Esc, or control/scrim `link: { to: "<baseFrameId>", present: "navigate" }`

Static mock without Play: draw the open state on the host frame (scrim + panel as absolute children). Prefer paired frames when closed and open both matter.

### Motion
Optional tokens `motion.fast` / `motion.base` (ms numbers, ~180 / ~240). Board motion = drawn pose (`opacity`, `transform`). Play animates overlay enter from `link.transition` (under ~300ms, ease-out). No keyframe timelines on nodes yet.

### Tokens (`tokens[name]`)
`{type:"color", value, modes?:{dark}}` · `{type:"number", value}` · `{type:"font", family, size, weight, lineHeight}` · `{type:"string", value}` · `{type:"shadow", value:<shadow | shadow[]>}`. Reference as `"$name"`. Groups: `color`, `space`, `radius`, `type`, `shadow`, `motion`.

### Ops (`design_apply`)
```
create           { op:"create", node:{type, name, ...}, parent:<frameId>, index? }
update           { op:"update", id, set:{...}, unset?:[...] }
move             { op:"move", id, parent:<frameId>, index? }
delete           { op:"delete", ids:[...] }
createFrame      { op:"createFrame", frame:{id?, name, x, y, width, height, layout, fill, ...}, page:<pageId>, index? }
moveFrame        { op:"moveFrame", id, page:<pageId>, index? }
createPage       { op:"createPage", id?, name, folder:<folderId|null> }
renamePage / movePage / deletePage { id, moveFramesTo? }
createFolder     { op:"createFolder", id?, name, parent:<folderId|null> }
renameFolder / moveFolder / deleteFolder
setToken         { op:"setToken", name, token | null }
upsertAnnotation { op:"upsertAnnotation", id?, annotation:{nodeId, body, status} }
deleteAnnotation { op:"deleteAnnotation", ids:[...] }
createComponent  { op:"createComponent", id?, name, root:<frameId>, props?, variants? }
setComponent     { op:"setComponent", id, component:<ComponentDef|null> }
```
Prefer `design_components` for list/create/instantiate. You may supply your own ids (`fr_home`, `bt_cta`, `tx_title`); otherwise they are generated. Place new top-level frames so they don't overlap: next free `x` = max(existing x + width) + 80.

## Naming (required)

Every node must have a human-readable **`name`** (Title Case, role-based). Never leave `name` empty. Never use the type as the name (`"frame"`, `"text"`, `"rect"`).

| | Convention | Examples |
|---|---|---|
| **Ids** (machine) | `{role}_{slug}` snake_case | `fr_login`, `bt_sign_in`, `tx_email_label`, `ic_mail`, `in_password`, `row_remember` |
| **Names** (human) | Title Case role in the UI | `Login`, `Sign in`, `Email label`, `Password field`, `Remember row` |
| **Icons** | `name` **is** the Lucide glyph id | `mail`, `lock`, `arrow-right` — put the UI role on the **parent frame** (`Email input`) |

Role id prefixes: `fr_` frame/artboard · `bt_` button · `in_` input · `tx_` text · `ic_` icon · `row_`/`col_` layout · `card_` · `img_` · `ch_` chart · `sh_` shape · `av_` avatar · `pr_` progress · `sk_` skeleton · `pg_` page · `fd_` folder.

```json
{ "id": "in_auth_email", "type": "frame", "name": "Email input", "children": ["ic_email", "tx_auth_email_ph"] }
{ "id": "ic_email", "type": "icon", "name": "mail", "width": 16, "height": 16 }
{ "id": "tx_auth_email_ph", "type": "text", "name": "Email placeholder", "content": "asha@northwind.io" }
```

If you omit `name` on create (except icons), the runtime fills one from the id — still prefer explicit names.

## Example — a new screen

```json
{ "ops": [
  { "op": "createFrame", "page": "pg_sprint", "frame": { "id": "fr_home", "name": "Home", "x": 480, "y": 0, "width": 390, "height": 844, "fill": "$color.bg", "clip": true,
      "layout": { "direction": "column", "gap": "$space.4", "padding": ["$space.6", "$space.4"], "align": "stretch" } } },
  { "op": "create", "parent": "fr_home", "node": { "id": "tx_home_title", "type": "text", "name": "Title", "content": "Today", "font": "$type.display", "fill": "$color.text", "width": "fill", "height": "hug" } },
  { "op": "create", "parent": "fr_home", "node": { "id": "bt_start", "type": "frame", "name": "Start workout", "width": "fill", "height": 48, "fill": "$color.accent", "radius": "$radius.md",
      "layout": { "direction": "row", "align": "center", "justify": "center" }, "children": [], "link": { "to": "fr_login", "transition": "push" } } },
  { "op": "create", "parent": "bt_start", "node": { "type": "text", "name": "Start label", "content": "Start workout", "font": "$type.label", "fill": "$color.onAccent", "width": "hug", "height": "hug" } }
] }
```
Then: `design_screenshot { nodeId: "fr_home" }`.

## Rules
- Taste pack applies on every task (injected by `design_guide`): modes, hard bans, viz playbook.
- Tokens first; raw hex/px only as a last resort.
- Flex by default; absolute only for overlays inside clipped frames. Screenshot self-check — avoid “photo then navy band.”
- Name every node (see Naming); never ship `name: "frame"`. No lorem — product-shaped copy.
- One `design_apply` batch per section; screenshot after.
- Keep the user's frames; don't delete or restyle what you weren't asked to touch.
- Writing repo files (export) always previews first; only write with `confirm: true` when the user asked for it.

## References (skill folder)

| File | Topic |
|---|---|
| `references/modes.md` | Persuade / Operate / Read / Experience |
| `references/aesthetics.md` | Anti-slop bans, color commitment, type, copy |
| `references/viz.md` | When to chart vs compose |
| `references/explore.md` | 3-variant divergence |
| `references/critique.md` | polish / quieter / bolder / distill |
