# Cursor Design — Research & Build Plan

*Prepared 2026-10-20. Updated for mockups-first delivery; revised after mockup review (folders → pages → frames, activity rail, confirmed writes). A Figma-like design/prototyping surface that runs inside Cursor as an extension, where the user chats with Cursor's agent and the agent builds and edits prototypes through MCP.*

**Working title:** cursor-design. **Mockup brand:** Draft (provisional — do not ship as “Canvas”).

---

## 1. Research summary

### 1.1 How Cursor can be extended (verified against cursor.com/docs, Oct 2026)

| Surface | Status | Relevance |
|---|---|---|
| VS Code extension API | Cursor 3.17 tracks VS Code API ~1.128 (Electron 40, Node 24). Extensions ship via **Open VSX** and `.vsix`. Webview + Custom Editor APIs are standard VS Code and are what Pencil uses. | Host the editor as a custom editor for a design file. |
| `vscode.cursor.mcp.registerServer()` | **Official Cursor-only API.** Registers an MCP server at runtime; accepts `{name, server:{url, headers?}}` (SSE / streamable HTTP) or `{name, server:{command,args,env}}` (stdio). `unregisterServer(name)` to remove. Returns `void`; no persistence guarantees, so re-register on every activation. Known bug (Aug 2026): sometimes shows "0 tools" until the server is toggled off/on. | **This is the integration hook.** Extension hosts an MCP server in-process on `127.0.0.1` and registers it. No manual `mcp.json` editing for the user. |
| `vscode.cursor.plugins.registerPath()` | Points Cursor at a directory containing `rules/`, `skills/`, `agents/`, `commands/`, `mcp.json`, `hooks/hooks.json`. Can live inside the extension bundle. | Ship a SKILL.md that teaches the agent the document schema and design workflow. |
| MCP support in Cursor | stdio, SSE, streamable HTTP; tools, prompts, resources, roots, elicitation; tools may return **images** (base64) which vision models see. ~40 active-tool cap (community-reported). Tools need approval unless user enables auto-run. Install deeplink: `cursor://anysphere.cursor-deeplink/mcp/install?name=…&config=<base64>`. | Keep tool count ≤ 12. Screenshot tool returns PNG so the agent can self-verify. |
| `vscode.lm` / Chat Participant API | **Not supported** in Cursor (staff confirmed Feb 2026). | **Cannot embed Cursor’s real agent chat** in the webview or call models from the extension. All AI flows: user → Cursor agent → our MCP tools. |
| Prompt deeplink | `cursor://anysphere.cursor-deeplink/prompt?text=…` prefills chat; user must press send. ~8k chars. | The single **Send to Cursor** handoff (annotation, selection, or system brief) builds a prompt and opens this deeplink. No in-app composer. |
| Hooks (`.cursor/hooks.json`) | `afterFileEdit`, `beforeMCPExecution`, `afterMCPExecution`, `afterAgentResponse`, `stop`, `workspaceOpen` (can return `pluginPaths`) … | Optional (Phase 3): after the agent edits source code, re-render imported frames. **Not** used for the activity rail — the in-process MCP server emits its own events. |
| Cursor CLI (`agent`) | Headless agent; unknown whether it loads extension-registered MCP servers. | Also write a stdio shim entry to `.cursor/mcp.json` on demand so CLI/cloud flows work. |
| Cursor's own Canvas + Design Mode | Cursor 3 (Apr 2026) added browser Design Mode; 3.7 (Jun 2026) added agent-built "Canvases" (dashboards/reports, shareable). Not a vector design editor; no public format. | Competitive overlap; position as the *design/prototype* layer, not the "artifact" layer. Avoid name/UX collision — never brand the product “Canvas”. |

### 1.2 Prior art

| Product | Shape | Lesson |
|---|---|---|
| **Pencil / pen.dev** (closed source, a16z-backed, 2026 breakout) | VS Code/Cursor extension + desktop app + CLI. Custom WebGL vector canvas. `.pen` JSON in repo. MCP over stdio → Unix socket to the running app. | Validates the exact product shape. Gaps: closed source, no collaboration, single screens not flows, no code round-trip, needs its app open. |
| **Paper** (paper.design) | HTML/CSS-native desktop surface + MCP (~24 tools). | HTML/CSS-native format beat Figma MCP on cost/speed/consistency in a Braintrust eval. Format matters more than renderer. |
| **Onlook** (OSS, ~26k stars) | Edits a running Next.js/Tailwind app via DOM overlay → AST writes. | Code-as-source-of-truth is hard. Start document-native; add code import later. |
| **Figma MCP** | Read tools + `use_figma` write, beta/paid. | Agents need write access; Figma gates it. |
| **Penpot** (MPL-2.0) | Rust/WASM Skia; MCP via plugin in an open browser tab. | Fragile when the tab closes. An extension that hosts both UI and MCP avoids this. |
| **tldraw** | Best whiteboard SDK; **source-available, watermark unless licensed**. | Unsuitable for an OSS, distributable extension. |
| **Excalidraw VS Code ext.** | Custom editor wrapping a React app, JSON doc. | Good structural template; wrong aesthetic. |

### 1.3 Technology conclusions

- **Renderer: hybrid DOM + overlay.** Frames render as real DOM (CSS flexbox, real text wrapping, fonts, images) inside a CSS-transformed board container; selection handles, guides, snapping lines on an SVG overlay; measurements via `getBoundingClientRect`.
- **Document: flat, id-keyed JSON** with CSS-like properties and a token table. Git-diffable, agent-addressable, trivial codegen.
- **Editing: single `applyOps()` reducer** used by UI, undo stack, and MCP. No CRDT in v1 (keep ops log so Loro/Yjs can slot in later).
- **File hosting: `CustomEditorProvider` with our own document model** (changed 2026-10-21). Cursor 3.19 failed to resolve a `CustomTextEditorProvider` whenever the custom editor was opened before the text document was mirrored to the extension host. With our own model: undo/redo are **ops-based** (inverse ops per batch), dirty state / save / hot-exit backups go through the provider callbacks, agent batches auto-save (`cursorDesign.autoSaveAgentEdits`), and a file watcher reloads clean documents on external edits (git, hand edits).
- **MCP: streamable HTTP server inside the extension host** (`@modelcontextprotocol/sdk` + Node `http` on an ephemeral `127.0.0.1` port, bearer token in `headers`), registered via `vscode.cursor.mcp.registerServer`.

---

## 2. Product definition

**One-liner:** An open-source, Cursor-native design surface. Define a **token-based design system**, prototype screens and flows with the agent, refine visually, export to React/Tailwind — design file and theme stay in git next to the code.

**Positioning (honest for v1):** Canvas-native design document + **first-class design tokens** with a live agent loop. Screens and the design system share one token table. **Product bet (updated 2026-10-21): impressive prototypes come before codegen** — Phase 1c ships polish (shadows, gradients, icons, charts) *and* **composition control** (absolute children, image fill, z-index, layered fills, backdrop-blur, transform, negative margin), because flex-only stacks cannot produce cinematic cards / overlays. **Deterministic React/Tailwind (+ theme) export is a Phase 2 outcome** — do not claim “design = code” until codegen ships.

**Differentiators vs Pencil:** MIT open source · **design-system tokens as MCP surface** (get/set, Tailwind/`@theme` sync, theme export) · multi-screen flows + play mode · HTML/CSS-native rendering aimed at export fidelity · zero-config MCP · headless CLI.

**v1 scope (MVP):**
- File type `*.design.json` (one file = one project, many pages/screens).
- **Design tokens (design system core):** colors, space, type, radius, shadow, motion; light/dark aliases; all node fills/type/spacing reference `$token` names. Agent **must** read/write tokens before inventing raw hex/px values.
- Hierarchy (Figma model): **folders → pages → frames**. Folders organize pages (nestable). A page is a collection of frames; the board shows **one page at a time**. Frames hold the node tree.
- Nodes: frame (flex *or* absolute layout), rectangle, ellipse, text, image, component, instance; composition props (`zIndex`, image/layered `fill`, `backdropBlur`, `transform`, negative margin); prototype links (may cross pages).
- **Annotations:** pin a note on a node; comment → Cursor agent via deeplink + MCP.
- Editor: pan/zoom, select/multi-select, move/resize, reorder, align/snap, **pages tree (folders → pages → frames)**, properties, **tokens panel**, play mode, annotate tool.
- Agent: MCP tools to manage tokens, mutate nodes, screenshot, highlight, annotations, export code **and theme**.
- Export: React + Tailwind components + theme/token files (deterministic) — Phase 2.

**Non-goals for v1:** pen/vector path editing, boolean ops, real-time multiplayer, collaborative comment threads (multi-author review), plugins.

### 2.1 Flow inventory

| Flow id | Actor | Happy path | Mockup route | Phase |
|---|---|---|---|---|
| `F_new_file` | User | Command → empty `*.design.json` opens | `#/` · `#/error/no-file` | 0a / 1a |
| `F_open_file` | User | Open file → store + UI hydrate | `#/board` | 0a / 1a |
| `F_agent_list` | Agent | `design_list` with 0/1/N files | `#/error/no-file` | 0a / 1a |
| `F_agent_build_screen` | Agent | tokens → apply → screenshot → iterate | `#/board/live` | 0a / 1a |
| `F_agent_edit_selection` | User+Agent | Select → Send to Cursor → apply | `#/review` | 0a / 1a |
| `F_activity_rail` | User | Rail mirrors MCP tool calls for this file (events from the in-process server) | `#/board/live` | 0a / 1a |
| `F_annotation_comment` | User+Agent | Pin annotation → note → Send to Cursor (deeplink) → agent resolves via MCP | `#/review` | 0a / 1a |
| `F_ui_edit` | User | Move/resize → ops → patch → save | `#/board` | 0a / 1a |
| `F_pages_folders` | User+Agent | Folders → pages → frames; create/rename/move/delete; switch active page; drag between folders | `#/board` pages tree | 0a / 1b |
| `F_undo_redo` | User | VS Code undo → reparse/patch | (types later) | 0b / 1a |
| `F_external_edit` | Git/user | Hand-edit / checkout → reparse | (types later) | 0b / 1a |
| `F_no_file_open` | Agent | list/get disk; apply needs open editor | `#/error/no-file` | 0a / 1a |
| `F_conflict_queue` | User+Agent | UI + MCP batches serialize | (types later) | 0b / 1a |
| `F_mcp_reconnect` | User | Reconnect after “0 tools” | `#/error/mcp` | 0a / 0c |
| `F_export_code` | Agent/User | Node → React/Tailwind files (preview → confirm) | `#/ship` | 0a / 2 |
| `F_design_system_tokens` | User+Agent | Browse/edit token table; agent get/set; sync Tailwind/`@theme`; export theme | `#/system/*` | 0a / 1a |
| `F_tokens_tailwind` | Agent | Bidirectional import/export with `tailwind.config` / `@theme` (preview → confirm) | `#/system/import` · `#/system/export` | 0a / 2 |
| `F_play_prototype` | User | Click links between frames (across pages) | `#/play` | 0a / 2 |
| `F_import_html` | Agent | HTML/URL → nodes | (deferred) | 3 |

**Day-to-day rule:** new flow → mockup → sign-off → types/fixtures → implement.

### 2.2 UX principles (locked after critique)

1. **One first-run journey:** Welcome → System (tokens) → Board → Review → Ship. Feature islands are secondary.
2. **One agent handoff:** annotations / selection → **Send to Cursor** (prompt deeplink). No embedded Cursor chat; no second in-app composer.
3. **Activity ≠ chat:** side rail mirrors MCP tool activity only.
4. **Token-first properties:** fills/space/type/radius pick `$tokens`; raw values are escape hatches.
5. **Quiet chrome / loud content:** Draft shell stays neutral; customer UI owns its palette on the board.
6. **Ship climax:** theme + screens landed in the repo; generated code is progressive disclosure.
7. **Board is format-agnostic:** not a mobile tool and not a web-only tool. Frames are arbitrary artboards (any size). Users + Cursor agent design *whatever the brief is* — app screens, marketing pages, dashboards, email, decks, design-system docs — constrained by tokens/components/MCP tooling, not by a fixed device class. Device presets (phone, desktop, …) are shortcuts, not the product identity. Play mode is optional link-through when prototype links exist.
8. **Figma hierarchy — folders → pages → frames:** folders are organization only (nestable, no geometry). A page is a collection of frames with its own board viewport; the board shows **one page at a time** and switching pages swaps the viewport. Frames are the artboards. The pages tree shows all three levels: selecting a page switches the board, selecting a frame selects it on the board. Agent can create/rename/move/delete folders, pages, and frames via ops / MCP.
9. **Lives inside an editor group:** the webview is commonly 800–1000 px wide (chat sidebar open). Side panels collapse to drawers; the board is always visible; chrome follows the VS Code theme (dark by default for most Cursor users).

Mockup routes: `/` · `/system` · `/board` · `/board/live` · `/review` · `/ship`.

**System feature workflows (full draft):** [docs/system-workflows.md](docs/system-workflows.md) — entry fork, import/blank/agent seed, edit/add/rename/delete, where-used, board binding, agent build/extend, theme export, drift, light/dark, acceptance criteria.

---

## 3. Architecture

```
┌──────────────────────────── Cursor (Electron) ─────────────────────────────┐
│  Cursor Agent (chat)  ──MCP (streamable HTTP, 127.0.0.1:port, bearer)──┐    │
│        ▲  reads SKILL.md via plugins.registerPath                       │    │
│  ┌─────┴────────────────── Extension Host (Node) ─────────────────────────┐ │
│  │  DocumentStore  · CustomTextEditorProvider  · McpServer                │ │
│  │  Codegen / Import / Tokens  · Commands / deeplink                      │ │
│  └───────────────▲──────────────── postMessage ───────────────▼────────────┘ │
│  ┌───────────────┴──────────── Webview (React) ───────────────────────────┐ │
│  │  Board + SVG · Pages · Properties · **Activity rail** · Play · Shot   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Activity rail (not a chat):** a dock that mirrors MCP tool calls for this design file. Events come straight from the in-process MCP server over `postMessage` — no Cursor hooks, nothing written into the user’s `.cursor/`. The only composer is **Send to Cursor** (annotation, selection, or system brief): it builds a prompt and opens the `cursor://…/prompt` deeplink; the user presses send in Cursor. The extension never runs its own model.

Real editor UI is a **port of `mockups/`**, not a second design pass.

### 3.1 Monorepo layout (pnpm + TypeScript)

```
cursor-design/
  mockups/       Phase 0a: standalone Vite/React click-through (THIS FIRST)
  packages/
    core/        schema (zod), types, applyOps, undo, validation, ids
    layout/      DOM-free layout helpers, token resolution, Tailwind mapping
    codegen/     node tree → React/Tailwind emitters
    importer/    HTML/DOM → node tree
    editor/      React webview (ported from mockups/)
    mcp/         MCP tool definitions + handlers
  apps/
    extension/   VS Code/Cursor extension, custom editor, MCP host
    cli/         headless: validate, render, export, serve-mcp
  plugin/        skills/, rules/
  examples/      sample .design.json + flow fixtures
  docs/
```

### 3.2 Document format (v1 sketch)

**Rules:**
- **Hierarchy:** `folderRoot` → `folders[id].children` (folder ids *and* page ids, display order) → `pages[id].frames` (top-level frame ids, z-order) → `nodes[id].children`. **Single direction only** — no `page` / `folder` / `parent` back-pointers; parents are derived by indexing at load.
- Flat `nodes` map; 8-char prefixed ids (`fd_`, `pg_`, `fr_`, `tx_`, `bt_`, `cp_`, `an_`); `width/height` ∈ number | `"fill"` | `"hug"`; tokens as `"$name"`; images as sibling `assets/…` paths **or** as frame `fill` (`{ kind: "image", src, fit? }`); stable key order + 2-space indent on save.
- **Composition (Phase 1c.0):** frames default to flex auto-layout; `layout.mode: "absolute"` makes the frame a positioning context so nested children honor `x`/`y` (today `x`/`y` only work on top-level frames). Optional node props: `zIndex`, `backdropBlur`, `transform: { x?, y?, scale?, rotate? }`, negative `margin` on layout. `fill` expands to `color | gradient | image | Fill[]` (layered fills for image+scrim without an extra node). Scrims/masks are **composed** (absolute gradient rect or layered fill) — not a dedicated node type. Opacity already exists.
- Token values carry a `modes` map (`light` is the base `value`; `modes.dark`, later `modes.hc` …) so a third mode never needs a schema migration.
- Fonts in examples are illustrative — product defaults avoid generic UI stacks (Inter/Roboto/Arial/system).

```jsonc
{
  "schemaVersion": 1,
  "name": "Pulse",
  "tokens": {
    "color.accent":  { "type": "color", "value": "#2DD4A8", "modes": { "dark": "#5EE4C1" }, "group": "color" },
    "color.bg":      { "type": "color", "value": "#0B1F1A", "modes": { "dark": "#061410" }, "group": "color" },
    "color.text":    { "type": "color", "value": "#E8F5F0", "group": "color" },
    "space.4":       { "type": "number", "value": 16, "group": "space" },
    "radius.md":     { "type": "number", "value": 12, "group": "radius" },
    "type.display":  { "type": "font", "family": "Syne", "size": 28, "weight": 700, "group": "type" }
  },
  "folderRoot": ["fd_marketing", "fd_product"],
  "folders": {
    "fd_marketing":  { "name": "Marketing",  "children": ["pg_web", "pg_email"] },
    "fd_product":    { "name": "Product",    "children": ["pg_auth", "fd_onboarding"] },
    "fd_onboarding": { "name": "Onboarding", "children": ["pg_welcome"] }
  },
  "pages": {
    "pg_web":     { "name": "Web",     "frames": ["fr_landing", "fr_pricing"] },
    "pg_email":   { "name": "Email",   "frames": ["fr_winback"] },
    "pg_auth":    { "name": "Auth",    "frames": ["fr_login", "fr_signup"] },
    "pg_welcome": { "name": "Welcome", "frames": ["fr_welcome1", "fr_welcome2"] }
  },
  "nodes": {
    "fr_login": {
      "type": "frame", "name": "Login",
      "x": 0, "y": 0, "width": 390, "height": 844,
      "layout": { "direction": "column", "gap": "$space.4", "padding": [24, 20],
                  "align": "stretch", "justify": "start" },
      "fill": "$color.bg",
      "children": ["tx_title", "bt_submit"],
      "preset": "phone" /* optional shortcut — frames may be any W×H */
    },
    "tx_title": {
      "type": "text", "content": "Welcome back",
      "font": "$type.display", "fill": "$color.text", "width": "fill", "height": "hug"
    },
    "bt_submit": {
      "type": "instance", "component": "cp_button",
      "props": { "label": "Sign in", "variant": "primary" },
      "link": { "to": "fr_welcome1", "transition": "push" } /* links may cross pages */
    },
    "cp_button": {
      "type": "component", "name": "Button",
      "props": {
        "label": { "type": "string", "default": "Button" },
        "variant": { "type": "enum", "values": ["primary", "ghost"], "default": "primary" }
      },
      "variants": { "primary": {}, "ghost": {} },
      "children": [],
      "codeRef": { "path": "src/ui/Button.tsx", "export": "Button" }
    }
  },
  "components": ["cp_button"],
  "annotations": {
    "an_cta1": {
      "nodeId": "bt_submit",
      "anchor": { "x": 0.5, "y": 0.92 },
      "body": "Make the CTA full-width and increase tap target to 48px.",
      "status": "open",
      "createdAt": "2026-10-20T18:00:00Z"
    }
  }
}
```

Annotations are first-class doc data (not a side channel). `anchor` is normalized 0–1 within the target node’s box. Status: `open` | `sent` | `resolved`.

### 3.3 DocumentStore sync protocol

```
UI ──ops──► DocumentStore ──patch(changed ids)──► UI
MCP ─ops──► DocumentStore ──debounced WorkspaceEdit──► TextDocument
TextDocument (external edit) ──reparse──► DocumentStore ──full hydrate──► UI
```

- **DocumentStore is authoritative** while a file is open.
- UI and MCP only call `applyOps`; the webview never rewrites full JSON locally as source of truth.
- Push **patches** (`changed` ids + doc version) via `postMessage`.
- Debounce writes to `TextDocument` with a version guard (avoid echo loops and full-doc reload thrash on agent batches).
- **Conflict policy:** single-writer queue; UI and MCP ops serialize; atomic batches (fail → doc unchanged); no merge in v1.
- **No file open:** `design_list` / `design_get` may read workspace `*.design.json` from disk; `design_apply` / `design_screenshot` require an open editor (or auto-open the sole/selected file) and return a clear error otherwise.
- **Local MCP auth:** ephemeral bearer on `127.0.0.1` only; regenerate per activation.
- **Privacy:** screenshots leave the machine only via the user’s Cursor agent; no product telemetry in v1.

### 3.4 Mutation API (shared by UI, undo, MCP)

```ts
type Op =
  // nodes (within a frame tree)
  | { op: "create"; node: Partial<Node> & { type: NodeType }; parent: Id; index?: number }
  | { op: "update"; id: Id; set: Partial<Node>; unset?: string[] }
  | { op: "move";   id: Id; parent: Id; index: number }          // reparent within/between frames
  | { op: "delete"; ids: Id[] }
  // frames ↔ pages
  | { op: "createFrame"; frame: Partial<FrameNode>; page: Id; index?: number }
  | { op: "moveFrame";   id: Id; page: Id; index?: number }      // move a top-level frame to another page
  // pages ↔ folders
  | { op: "createPage"; id?: Id; name: string; folder: Id | null; index?: number }
  | { op: "renamePage"; id: Id; name: string }
  | { op: "movePage";   id: Id; folder: Id | null; index?: number }
  | { op: "deletePage"; id: Id; moveFramesTo?: Id }             // blocked if frames exist and no target
  // folders
  | { op: "createFolder"; id?: Id; name: string; parent: Id | null; index?: number }
  | { op: "renameFolder"; id: Id; name: string }
  | { op: "moveFolder";   id: Id; parent: Id | null; index?: number }  // cycle-checked
  | { op: "deleteFolder"; id: Id; moveChildrenTo?: Id | null }
  // design system & review
  | { op: "setToken"; name: string; token: Token | null }
  | { op: "upsertAnnotation"; id?: Id; annotation: Annotation }
  | { op: "deleteAnnotation"; ids: Id[] };
applyOps(doc, ops): { doc, inverse: Op[], changed: Id[], errors?: ValidationError[] }
```
Every structural op rewrites exactly one `children` / `frames` array (single-direction refs), so inverses are trivial and git diffs stay local.

### 3.5 MCP tools (≤ 12, plus resources)

| Tool | Purpose |
|---|---|
| `design_list` | List open/available design files, pages, top-level frames. |
| `design_get` | Node subtree (depth-limited) or doc summary; optional `annotations: true`. |
| `design_apply` | Batch ops (incl. annotation upsert/delete); returns changed ids, errors, optional thumbnail. |
| `design_screenshot` | Frame/node → PNG (MCP image). **In-webview `html-to-image` capture** (decided in Phase 0c; no extra deps, exact frame pixels). The CLI reuses the same capture inside headless Chrome for CI. Requires the file to be open in the editor (auto-opens it). |
| `design_inspect` | Frame/node → measured bounds, overlaps, clipping, text-overflow, key computed styles (DOM via webview). Pairs with screenshot for layout debug. Requires open editor. |
| `design_select` | Highlight/select; scroll into view; can focus an annotation pin. |
| `design_get_selection` | Current selection **and open annotations on that selection** (for “make this bigger” / annotation prompts). |
| `design_tokens` | **Design-system API.** `action`: `list` \| `get` \| `set` \| `batchSet` \| `delete` \| `fromTailwind` \| `toTailwind` \| `exportTheme`. Filter by `group` (color/space/type/radius/shadow). Returns resolved light/dark values. |
| `design_components` | **Components API (1c.3).** `action`: `list` \| `get` \| `create` \| `update` \| `delete` \| `instantiate` \| `usages`. Masters + instances; props/variants. |
| `design_export_code` | Emit React/Tailwind **and optional theme file** (`tokens.css` / `@theme`); node styles emit `$token` → Tailwind/`var(--…)` refs, never raw one-offs unless unmarked. **Preview by default**: returns the files/diff; writes only with `confirm: true`, via `WorkspaceEdit`. |
| `design_import_html` | HTML string / dev-server URL → nodes. |
| `design_guide` | Schema + workflow (same text as SKILL.md). |

No extra tool for annotations — keep ≤ 12 by folding into `design_get` / `design_get_selection` / `design_apply`.

Resources: `design://<file>`, `design://<file>/tokens`, `design://<file>/tokens/{name}`, `design://<file>/<nodeId>`, `design://<file>/annotations/<id>`. Prompt: `design-screen` · `design-system` (“define/extend tokens for &lt;brand&gt; then build screens”).

**`design_tokens` contract (agent + design system):**

```ts
// list / get
{ action: "list", group?: "color"|"space"|"type"|"radius"|"shadow" }
// mutate design system
{ action: "batchSet", tokens: Record<string, Token> }
// sync with repo theme
{ action: "fromTailwind", path?: string }  // pull tailwind.config / @theme → doc.tokens
{ action: "toTailwind", path?: string, confirm?: boolean }    // doc.tokens → config / @theme
{ action: "exportTheme", format: "css-vars"|"tailwind-v4"|"json", path?: string, confirm?: boolean }
```

**Repo-write policy (all tools):** anything that touches workspace files (`toTailwind`, `exportTheme`, `design_export_code`) returns a **preview/diff by default** and writes only when `confirm: true`. Writes go through VS Code `WorkspaceEdit`, so they show up in the editor and are undoable. The UI paths (Export theme, Ship) use the same preview → confirm → write sequence.

Hard rule in SKILL.md: **never hardcode colors/spacing/type in `design_apply` — reference `$tokens` or create tokens first.**

**Annotation → agent handoff:** “Send to agent” builds a prompt deeplink:

```
Address annotation an_cta1 on bt_submit (Login / Sign in):
"""
Make the CTA full-width and increase tap target to 48px.
"""
Use design_get_selection / design_get, apply ops, then screenshot. Mark annotation resolved when done.
```

User still presses send in Cursor chat. Status flips `open` → `sent`. Agent (or UI after success) sets `resolved`.

### 3.6 Agent guidance (plugin dir)

- `skills/design-canvas/SKILL.md`: tools, schema cheat-sheet (folders → pages → frames; single-direction refs), workflow (**`design_tokens` first** → components → apply → screenshot → iterate → export theme+screens), **always read open annotations**, always screenshot after a batch, never write repo files without `confirm: true`. Name the skill after the product, not “Canvas”, if we rename.
- `rules/design-canvas.mdc`: `*.design.json` must be edited via MCP, not by hand; node styles should use `$token` refs.

### 3.7 Integration flow (user experience)

1. Install extension → MCP register + plugin path → toast to auto-run `design_*`.
2. “Draft: New file” → `app.design.json` in the editor.
3. Chat (or **Generate with agent** → Send to Cursor): “Set up a Pulse design system then build the login screen” → agent calls `design_tokens`, then builds the first frame on those tokens. The default brief asks for tokens **plus a first screen**; tokens-only is the opt-out.
4. Open **Tokens** panel to review/edit the system; optional sync from existing Tailwind.
5. Tweak screens; “Ask agent” / annotations → deeplink with selection + token context.
6. Export screens **and** theme (`tokens.css` / `@theme`) to the repo: preview → confirm → `WorkspaceEdit` (Phase 2).

---

## 4. Phased roadmap

### Phase 0a — Visual mockups (done; fix list below)
Goal: sign off UX before schema or Cursor APIs.
- [x] Standalone `mockups/` (Vite + React) with click-through for inventoried flows.
- [x] Screens: welcome, system (fork/import/generate/workspace/export), board, agent-building state, review/annotate, play, ship, no-file / MCP errors.
- Mockup fixes before port (from review 2026-10-20):
  - [x] Board layout at 800–1000 px: side panels collapse to overlay drawers (<1100 px); board always visible.
  - [x] Dark chrome variant (toggle in nav, follows OS by default); semantic chrome vars ready to map onto VS Code theme variables at port time.
  - [x] Fonts bundled via `@fontsource` (Google Fonts link removed).
  - [x] Pages tree shows folders → pages → frames; selecting a page switches the board (one page at a time); drag pages→folders, frames→pages; `mockups/src/board/doc.ts` mirrors §3.2.
  - [x] Overlays no longer cover artboards: prompt/next-step dock at the bottom; agent status moved into the activity rail head; annotation composer lives in the right panel.
  - [x] Properties panel shows node props (layout, fill, stroke, radius, text style, prototype link) bound to tokens; instance/text show their own size.
  - [x] Cursor chat prompt shown in the board dock before “Simulate agent build”.
  - [x] Play toolbar spacing (+ back trail, cross-page links); welcome hero gets faint artboard silhouettes.
- Exit: walk Phase 1–2 flows in the browser and approve layout.

### Phase 0c — Integration spikes (DONE 2026-10-21 — exit criterion met in Cursor 3.19.7)
Code lives in the monorepo (`packages/core`, `packages/mcp`, `packages/editor`, `apps/extension`, `apps/cli`). What is verified by automated tests vs. what needs a human in Cursor:

**Verified outside Cursor (tests + smoke):**
- [x] `applyOps` reducer with inverse ops, atomic batches, folders → pages → frames ops, delete/restore round-trip, stable serializer (`packages/core` tests).
- [x] Streamable-HTTP MCP server on 127.0.0.1 with bearer auth, stateless per-request servers; 8 `design_*` tools; validation errors come back as tool errors (`packages/mcp` test with the official MCP client).
- [x] Editor webview bundle renders DOM frames, applies ops, draws selection overlay, and captures a node to PNG with `html-to-image` (`packages/editor` headless test).
- [x] Integration test in VS Code 1.143 (`pnpm --filter cursor-design run test:integration`): open custom editor → MCP apply (auto-saved) → webview PNG → select → ops-based undo → save → external edit reload.
- [x] Extension bundle activates against a stubbed `vscode` with the `cursor` namespace: registers the custom editor, commands, `vscode.cursor.mcp.registerServer` (URL + bearer header) and `vscode.cursor.plugins.registerPath`; an MCP client then lists tools and reads the example file; `design_screenshot` without an open webview fails with a clear `NO_ACTIVE_DOCUMENT`.
- [x] CLI: `validate`, `render` (headless via the installed Chrome channel, no Chromium download), `mcp` over stdio (for Cursor CLI / CI).
- [x] `cursor-design.vsix` packages (dist + media + plugin skill/rule).

**Findings from the first runs in Cursor (2026-10-21, user's Cursor build):**
- `vscode.cursor.mcp.registerServer` works, **but Cursor drops the `headers` of extension-registered servers** (all requests arrived without Authorization; Cursor then treated our 401 as an OAuth challenge and failed with 404). Fix: the registered URL carries the bearer token as `?token=` and the server accepts header *or* query token. Keep both.
- `vscode.cursor.plugins.registerPath` is **not present** in this build, so the bundled skill never reached the agent. Fallback shipped: one-time prompt / command to copy SKILL.md + rule into `~/.cursor/skills` and `~/.cursor/rules`. Re-check on newer Cursor builds.
- Custom editor opened fine once, then failed with "Unable to open … Assertion Failed" in later windows: Cursor's extension host threw "Unable to retrieve document from URI" before our `CustomTextEditorProvider` ran, even with the extension active and the file pre-opened. **Resolved by switching to `CustomEditorProvider`** (own document model; see §1.3). Integration test covers open → apply → screenshot → undo → save → external reload.
- Verified in VS Code 1.143 by `apps/extension/test` (integration harness): open custom editor → MCP apply → TextDocument updated → webview screenshot PNG → select/selection → Cmd+Z reverts the batch.

**Needs a manual run in Cursor (`pnpm dev:cursor`, or install the VSIX):**
- [x] Custom editor opens `examples/pulse.design.json` in Cursor 3.19.7 (after the `CustomEditorProvider` switch); bundle, fonts and `data:` images render.
- [x] Cursor's MCP client connects to the registered server (query-token auth) and the agent calls the tools.
- [x] The agent discovers the `cursor-design` skill via the `~/.cursor/skills` fallback ("The design skill says to use MCP tools").
- [x] **Exit criterion met (2026-10-21):** “Add a blue button under the password field on the Login frame, then screenshot it” → agent added a `$color.blue` token + button via `design_apply`, called `design_screenshot`, and the button appeared live in the editor.
- [ ] Undo (Cmd+Z) in Cursor reverts an agent batch; external edits re-render (both verified in VS Code by the integration test; not yet hand-checked in Cursor).
- [ ] Zoom/perf with ~50 frames; dark/light theme vars inside the webview.

**Screenshot decision (spike result):** both paths render the same DOM, so output is pixel-identical. **Primary = in-webview `html-to-image`** (no extra dependencies, exact frame pixels, independent of board zoom). **Headless Playwright/Chrome = CLI/CI path only**, using the installed Chrome channel first and a Playwright Chromium only if present — no forced 150 MB download. Recorded in §6.

### Phase 0b — Flow types & fixtures (in parallel with 0c; freeze after 0c)
- Minimal zod in `packages/core` aligned to mockups + §3.2 (folders/pages/frames, tokens with `modes`, `Op`, MCP + webview messages).
- `examples/flows/` fixtures + `applyOps` round-trip tests for `F_ui_edit`, `F_agent_build_screen`, `F_pages_folders`.
- If the screenshot spike needs a headless renderer, extract the document → DOM renderer into a shared package used by both the webview and the CLI **before** freezing.
- Exit: every inventoried flow has types or an explicit stub/deferral.

### Phase 1a — Agent-loop vertical slice (DONE 2026-10-21) — built on the 0c scaffold
- [x] Minimal editor: frames, text, rect; select / **move / resize** (interactive corner handles, one undoable batch per gesture); pan/zoom; pages tree with page switching + **rename** (double-click); **annotate** (Comments section in Properties + board pins + per-note Send to Cursor); **tokens panel** (grouped list, edit color/number value, color picker, `modes` chips, where-used count → selects usages, add/delete).
- [x] `core` + DocumentStore already carry `tokens`, `annotations`, `setToken` / `upsertAnnotation` / batch.
- [x] MCP: `design_list/get/apply/screenshot/select/get_selection/tokens/guide` (all 8 present, frozen).
- [x] SKILL.md: tokens-first workflow + "build the palette first" note.
- [x] Tests: `packages/core` token + annotation round-trip (set/usages/overwrite/delete undo; upsert/status/delete undo); `packages/editor` headless drives resize, token edit, annotation add + pin + Send to Cursor; VS Code integration (8 steps) green.
- UI switch: left panel has a **Pages | Tokens** segmented control in the toolbar; Properties gained a Comments section. CSS added for segmented control, tokens, notes, resize-cursor handles, pins.

### Phase 1b — Editor completeness (mostly DONE 2026-10-21)
- [x] **Snap/align:** dragging or resizing a frame snaps its edges/centers to neighbouring frames (6px screen threshold); dashed guide lines show the active snap. Snapped position is what commits.
- [x] **Pages tree drag-and-drop:** drag frames between pages (reorder + relocate), pages into/among folders, folders into folders (nested) with before/after/into zones and cycle guard; drop on the header to move to root. Rename (double-click) already shipped in 1a.
- [x] **Properties polish + auto-layout:** align, justify, padding (scalar / `[v,h]` / `[t,r,b,l]`) controls; token-aware pickers for Fill/Color (color tokens), Radius + Gap (number tokens), Font (font tokens).
- [x] Ellipse + image **render** on the board and the agent can create them over MCP.
- [x] Tests: `packages/core` move/reorder + nesting + cycle-guard; `packages/editor` headless drives a snap-to-neighbour drag and asserts the guide + snapped coordinate.
- [ ] **Deferred (lower priority — agent is the primary author):** a manual draw toolbar (frame/text/rect/ellipse/image), and marquee drag-select (shift-click multi-select already works).
- [ ] Dogfood: settings screen built unaided.

### Phase 1c — Expressiveness / visual richness (NEW — before export)
**Why first:** polish alone is not enough — flex-only stacks cannot put copy/scrim on media, so heroes and carousels collapse into “photo then navy band.” Product bet (updated 2026-10-21): **impressive prototypes come before codegen** — Phase 1c ships **composition primitives** (1c.0) plus polish (1c.1 done; 1c.2 icons/charts/shapes). All of this is **new node types + properties via existing `design_apply` create/update — no new MCP tools** (≤12 cap holds). Renderer stays HTML/CSS in `packages/editor/.../NodeView.tsx` (flex *or* absolute); richer vector primitives render as inline `<svg>` children (no scene-graph rewrite).

- [x] **1c.0 Composition primitives (DONE 2026-10-21 — unlock overlay cards):** reusable schema/renderer building blocks extracted from dogfood feedback. Shipped through `design_apply` + `NodeView` + SKILL/`design_guide`; no carousel widget. Prefer flex by default; absolute only for overlays / free placement inside a clipped card. Sample `fr_hero` is the exit card (image fill + absolute scrim + copy).
  - **Must-have (shipped):**
    - **Absolute layout mode** — `layout.mode: "flex" | "absolute"` (default flex). Absolute children honor `x`/`y`; `"fill"` size → 100% of parent; `clip` unchanged.
    - **Image as fill** — `{ kind: "image", src, fit?: "cover" | "contain" }`.
    - **`zIndex`** — optional number on any node.
  - **Overlay helpers (shipped):**
    - **Layered / multi fill** — `fill: Fill | Fill[]` (first layer paints on top).
    - **`backdropBlur`** — number or `$token` → `backdrop-filter`.
    - **Opacity** — already shipped.
    - **Scrim / mask** — composed (absolute gradient rect or layered fill); no dedicated node.
  - **Stack / peek (shipped):** `transform {x?,y?,scale?,rotate?}`; `layout.margin` (negatives OK).
  - **Not in 1c.0:** carousel widget; components/instances (1c.3); whole-layer blur; named `mask`; gradient text.
  - **SKILL pattern:** clipped frame → image (or layered) fill → absolute scrim → absolute copy (`zIndex`). Flex default.
  - Tests: core round-trip + sample `fr_hero`; editor headless builds absolute card + peek (transform/negative margin).
  - Exit (1c.0): met via sample `fr_hero` (image fill + absolute scrim + copy).

- [x] **1c.1 Cheap CSS wins — DONE 2026-10-21:** shipped shadow (inline `{x,y,blur,spread?,color,inset?}`, array, or `$shadow` token; composed with stroke in one `box-shadow` list), gradient fills (`{kind:"linear"|"radial", angle?, stops:[{color,at}]}`, stop colors resolve `$` refs), per-corner radius (`[tl,tr,br,bl]`), and a `shadow` token type. Schema + renderer (`NodeView.tsx`) + Properties (gradient/shadow read-only, radius tuple-aware) + `SKILL.md` updated. Tests: core round-trip (gradient/radius/shadow/shadow-token + schema reject of a 1-stop gradient) and editor headless (gradient + shadow + per-corner-radius card renders). All suites green incl. 8/8 integration.
  - **Shadow as a first-class property**, separate from `stroke`. Correction (2026-10-21): the schema does **not** yet reserve `shadow` tokens — the `Token` union is `color|number|string|font` only; 1c.1 **adds** a `shadow` token type + a node `shadow` property (one shadow or a list; `{x,y,blur,spread?,color,inset?}`), not just uses one. The `boxShadow` collision in `NodeView.tsx` is real but composable: `box-shadow` takes a comma-separated list, so the inset stroke and an outer drop shadow can share the slot (or move stroke to `outline` to avoid a border-box layout shift).
  - **Gradient fills** (linear/radial) as a `fill` variant (`fill = color | gradient`); gradient stop colors may be `$color` refs (resolved per-stop in the renderer). Extended further in 1c.0 to image + layered fills.
  - **Per-corner radius** (`radius = number | $ref | [tl,tr,br,bl]`).
  - Risk: near-zero (no agent geometry). Highest visual ROI per hour — but **not** sufficient for overlay composition (see 1c.0).

- [x] **1c.2 High-level primitives (DONE 2026-10-21 — inline SVG):** charts/icons/shapes for dashboards. Sample `fr_dash` uses real `chart` + `icon` nodes (not rect fakes).
  - **`icon`** — curated Lucide subset (~70), fully inlined paths (`packages/core/src/icons.ts` + `IconSvg`).
  - **`chart`** — bar/line/area/donut → deterministic inline SVG (`ChartSvg`).
  - **`shape`** — star/polygon/arrow → generated SVG (`ShapeSvg`).
  - **Catalog discovery:** `withPrimitiveCatalog()` appends icon names + chart/shape schema to `design_guide` (extension + CLI).
  - **Screenshot:** editor headless captures `fr_prim` (icon+chart+shape) via html-to-image; paths are inlined (no sprite/`foreignObject` fonts).

- [x] **1c.4 Next-gen expressiveness + widgets (DONE 2026-10-22):** property pack + three widgets; no new MCP tools. Sample `fr_nextgen`.
  - **Props:** `blur`, `mixBlendMode`, `mask`, `clipPath`, `outline`, frame `overflow`; fill kinds `conic` + `video`; text gradient fill + `letterSpacing` / `style` / `decoration` / `textTransform`.
  - **Shape/chart:** `line`, `blob`; chart `sparkline`.
  - **Widgets:** `avatar`, `progress` (linear|circular), `skeleton` (rect|circle|text).
  - Catalog via `withPrimitiveCatalog` / `design_guide`; editor screenshots `fr_nextgen`.

- [x] **Taste framework (DONE 2026-10-22):** skill `references/` (modes, aesthetics, viz, explore, critique) + always-on Taste pack injected by `design_guide` (`tastePackMarkdown` in `packages/core/src/guide.ts`). Synthesizes Taste Skill / Impeccable / Emil / Anthropic for the canvas medium — no third-party skill install, no new MCP tools.

- [x] **1c.5 Chart style polish (DONE 2026-10-22):** same kinds (`bar|line|area|donut|sparkline`); richer `options`: `chrome`, `rounded`, `strokeWidth`, `fillOpacity`, `showDots`, `valueLabels`, `goal`, `highlight`, `stacked`. Sample `ch_week` uses minimal chrome + rounded + goal + highlight. New kinds (heatmap/funnel/…) still later.

- [x] **1c.6 Overlay links + minimal Play (DONE 2026-10-22):** `link.present` (`navigate`|`overlay`) + slide transitions; compose drawers/modals (no new node types); skill `references/overlays.md` + taste pack; `motion.fast`/`motion.base` tokens; editor Play toolbar (overlay stack, Back/Esc, CSS enter). Sample `fr_home` / `fr_drawer` / `fr_modal`.

- [x] **1c.7 Inspect + layout skill (DONE 2026-10-22):** MCP `design_inspect` (9th tool, still ≤12) — webview-measured bounds, overlaps, clipping, text-overflow, key computed styles; skill `references/layout.md` (containers before coordinates); Taste pack section loop includes inspect.

- [x] **1c.3 Minimal components/instances (DONE 2026-10-22):** `doc.components` + `instance` nodes; `createComponent` / `setComponent` ops; expand-at-render with props/binds/variants/overrides; MCP `design_components` (10th tool); skill `references/components.md`. Sample `cp_button` + Sign-in instance. Nested override depth / codeRef stay Phase 2+.

- Tests (phase): core covers 1c.0–1c.7; editor headless covers overlay card + icon/chart/shape + nextgen widgets/screenshot.
- Exit (phase): (1) sample `fr_hero` cinematic overlay — met; (2) sample `fr_dash` with real chart + icons + shadows — met; (3) sample `fr_nextgen` expressiveness + widgets — met; (4) sample overlay Play (`fr_home`) — met; (5) sample `cp_button` instance — met.

### Phase 2 — Design system completeness + flows + export (weeks 6–9)
- Component **variants** on tokens (minimal instances shipped in 1c); light/dark; **`fromTailwind` / `toTailwind` / `exportTheme`**.
- Pages, prototype links, play mode polish (basic Play + overlay present shipped in **1c.6**).
- Deterministic codegen → React/Tailwind **+ theme file**; map 1c.0 composition to export (`absolute` / `left`/`top`, `z-index`, image/`bg` fills, `backdrop-blur`, `transform`, negative margins) so export does not invent a second layout model.
- Publish 0.1 to Open VSX.

### Phase 3 — Code round-trip + headless (weeks 10–13)
- HTML/dev-server import; `codeRef`; CLI `validate | render | export | mcp`; hooks; marketplace listing.

### Later
Multiplayer (Loro/Yjs) · **low-level vector pen / boolean ops** (optional — Phase 1c high-level primitives cover the richness without hand-written path math; a raw pen is a power-user add-on) · comments · Figma import · Storybook sync · carousel **prototype state** / carousel widget (compose from 1c.0 first) · text-on-path. (Layer blur, mask, gradient text shipped in **1c.4**.)

---

## 5. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Cursor expands Canvas/Design Mode | Stay OSS, repo-resident; Figma-grade editing + flows; avoid “Canvas” branding. |
| Pencil head start | Openness, flows, code round-trip, zero-config; consider `.pen` importer. |
| `registerServer` “0 tools” / no persistence / **headers dropped** | Re-register every activation; token in URL + header; reconnect command; `.cursor/mcp.json` fallback. |
| Text-document mirror races in Cursor | Own document model (`CustomEditorProvider`); no dependency on the TextDocument; watcher for external edits. |
| UI↔agent edit races | Serialized single-writer op queue; atomic batches. |
| No design file open | list/get from disk; apply/screenshot require open editor + clear error. |
| Screenshot fidelity vs install size | Decided: in-webview capture is primary; CLI uses the installed Chrome channel; no Chromium download in the extension. |
| Agent writes repo files silently | Preview by default; `confirm: true` to write; always via `WorkspaceEdit`. |
| Webview lives in an 800–1000 px editor group | Collapsible panels; board always visible; test at 800 px in every mockup/port review. |
| Light-only chrome in a dark IDE | Dark chrome variant in mockups; chrome tokens → VS Code theme vars at port. |
| Dual references drift (folder/page/frame) | Single-direction refs only; parent index derived at load; validator rejects orphans and cycles. |
| Webview CSP blocks code-frame iframes | Spike early; fallback to static DOM-extraction import. |
| Tool-approval friction | Prompt once to auto-run `design_*`; batch ops per screen. |
| MCP ~40-tool cap | ≤ 12 tools; fold variants into parameters. |
| Zoom/perf with many DOM frames | Virtualize off-screen; thumbnails at low zoom; cap page size. |
| CLI/cloud can’t reach localhost MCP | CLI stdio MCP on file; cloud out of scope. |
| Local MCP abuse | Ephemeral bearer; bind `127.0.0.1` only. |
| Privacy | Screenshots only via user’s agent; no v1 telemetry. |
| Schema/UI drift | Mockups → types → implement; goldens for codegen in Phase 2. |
| Agent overuses absolute layout | SKILL: flex default; absolute only for overlays inside clipped frames; screenshot self-check. |
| `backdrop-filter` / transform screenshot fidelity | Spike html-to-image early in 1c.0; fall back to opaque scrims if blur captures poorly. |

---

## 6. Decisions (locked)

1. **File naming:** `*.design.json` for v1.
2. **One file per project** (split by page later if needed).
3. **Tailwind:** support v3 config + v4 `@theme`; detect from repo (Phase 2).
4. **License:** MIT.
5. **Product name:** provisional mockup brand **Draft**; package/repo `cursor-design`; never ship as “Canvas”. Final name before 0.1.
6. **Delivery order:** mockups → Cursor spikes (types/fixtures in parallel, frozen after spikes) → Phase 1a agent loop.
7. **Hierarchy:** folders → pages → frames (Figma model); board shows one page at a time; single-direction references.
8. **Agent surface in the editor:** activity rail only; the single composer is Send to Cursor; no hooks dependency.
9. **Repo writes by the agent:** preview by default, `confirm: true` to write, via `WorkspaceEdit`.
10. **Screenshot primary path:** in-webview `html-to-image` (decided by the Phase 0c spike; identical pixels to headless Chrome). Headless Chrome/Playwright serves the CLI and CI only.
11. **Generate with agent default:** tokens **plus** a first screen; tokens-only is the opt-out.
12. **Composition primitives (2026-10-21):** Phase **1c.0** ships absolute layout mode, image fill, `zIndex`, layered fills, `backdropBlur`, `transform`, and negative margin via schema + renderer (no new MCP tools; no carousel widget). Scrim/mask = composed pattern. Flex remains the default layout mode.

---

## 7. Sources

- Cursor extension API: https://cursor.com/docs/extension-api
- Cursor MCP: https://cursor.com/docs/context/mcp · install links: https://cursor.com/docs/context/mcp/install-links
- Cursor plugins: https://cursor.com/docs/plugins · hooks: https://cursor.com/docs/hooks · skills: https://cursor.com/docs/skills · deeplinks: https://cursor.com/docs/reference/deeplinks · CLI: https://cursor.com/docs/cli/overview
- Cursor Canvas changelog: https://cursor.com/changelog/canvas-improvements · Cursor 3: https://cursor.com/changelog/3-0
- registerServer "0 tools" bug: https://forum.cursor.com/t/cursor-ide-mcp-server-provided-by-extension-displays-0-tools/169322
- `vscode.lm` unsupported: https://forum.cursor.com/t/support-for-language-model-tools/152071
- Pencil docs: https://docs.pencil.dev/getting-started/ai-integration · https://docs.pencil.dev/for-developers/the-pen-format · https://docs.pencil.dev/for-developers/pen-cli
- Paper vs Figma MCP eval: https://www.braintrust.dev/evals/paper-vs-figma-mcp
- Onlook: https://github.com/onlook-dev/onlook · Penpot MCP: https://glama.ai/mcp/servers/penpot/penpot-mcp
- tldraw license/pricing: https://tldraw.dev/legal/tldraw-license · https://tldraw.dev/pricing
- VS Code custom editors: https://code.visualstudio.com/api/extension-guides/custom-editors · webviews: https://code.visualstudio.com/api/extension-guides/webview
- Figma Code Connect: https://developers.figma.com/docs/code-connect/
