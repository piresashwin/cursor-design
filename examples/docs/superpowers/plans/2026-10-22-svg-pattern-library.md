# Pattern Library (motif + application) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `patterns.design.json` — a nine-motif two-tone pattern catalog with swatches plus application mocks on the Cursor Design canvas.

**Architecture:** One tall catalog frame (`fr_catalog`) on page `pg_catalog`. Motifs are composed from tiled primitives inside clipped absolute frames (not raw SVG). Shared tokens `color.ground` / `color.ink` drive every swatch and application. Build header → three motif rows → three application groups, screenshotting after each batch.

**Tech Stack:** Cursor Design MCP (`design_tokens`, `design_apply`, `design_screenshot`, `design_inspect`); design document `examples/patterns.design.json`. Spec: `docs/superpowers/specs/2026-10-22-svg-pattern-library-design.md`.

## Global Constraints

- Motifs composed from `rect` / `ellipse` / `shape` + clipped frames — never invent SVG `<pattern>` nodes.
- Two-tone only: `color.ground` (warm paper off-white) + `color.ink` (deep slate-blue); no third accent.
- Mode: **read** (quiet catalog chrome).
- New file only — do not modify Pulse, Meridian, LittleDay, Horizon, ERP, or Viz Catalog.
- Every node needs a Title Case `name`; ids use role prefixes (`fr_`, `tx_`, `el_`, `sh_`, `row_`).
- One `design_apply` batch per section; always `design_screenshot` after; `design_inspect` when layout looks wrong.
- File must be **open in the Cursor Design editor** before screenshot/inspect.
- Do **not** git commit unless the user explicitly asks.

---

## File map

| Path | Responsibility |
|---|---|
| `examples/patterns.design.json` | Sole design document (create empty shell, then all work via MCP) |
| Spec (read-only) | `examples/docs/superpowers/specs/2026-10-22-svg-pattern-library-design.md` |

---

### Task 1: Scaffold file, page, tokens, catalog frame + header

**Files:**
- Create: `examples/patterns.design.json` (minimal shell if missing)
- MCP: `design_tokens`, `design_apply`, `design_screenshot`

**Interfaces:**
- Consumes: none
- Produces: open file `patterns.design.json`; page `pg_catalog`; tokens listed below; frame `fr_catalog`; header nodes `tx_title`, `tx_subtitle`, `sw_ground`, `sw_ink`, `tx_sw_ground`, `tx_sw_ink`

- [ ] **Step 1: Ensure design file exists and is open**

If `design_list` does not show `patterns.design.json`, create a minimal valid document then ask the user to open it (**Cursor Design: Open…** / click the file):

```json
{
  "schemaVersion": 1,
  "name": "Pattern Library",
  "tokens": {},
  "components": {},
  "folderRoot": [],
  "folders": {},
  "pages": {
    "pg_catalog": {
      "id": "pg_catalog",
      "name": "Catalog",
      "frames": []
    }
  },
  "nodes": {},
  "annotations": {}
}
```

If the file exists but has no page, use `design_apply` → `createPage` with `id: "pg_catalog"`, `name: "Catalog"`, `folder: null`.

Verify: `design_list` includes `patterns.design.json` with page Catalog. Confirm the file is **open/active** in the editor before continuing.

- [ ] **Step 2: Batch-set tokens**

```
design_tokens { action: "batchSet", tokens: {
  "color.ground":  { type: "color", value: "#F3EEE6" },
  "color.ink":     { type: "color", value: "#1E3A4C" },
  "color.surface": { type: "color", value: "#Faf8f4" },
  "color.text":    { type: "color", value: "#1E3A4C" },
  "color.muted":   { type: "color", value: "#5A6B78" },
  "space.2": { type: "number", value: 8 },
  "space.3": { type: "number", value: 12 },
  "space.4": { type: "number", value: 16 },
  "space.5": { type: "number", value: 20 },
  "space.6": { type: "number", value: 24 },
  "space.8": { type: "number", value: 32 },
  "radius.md": { type: "number", value: 8 },
  "radius.lg": { type: "number", value: 12 },
  "type.display": { type: "font", family: "Fraunces", size: 40, weight: 600, lineHeight: 1.15 },
  "type.title":   { type: "font", family: "Fraunces", size: 22, weight: 600, lineHeight: 1.25 },
  "type.body":    { type: "font", family: "IBM Plex Sans", size: 14, weight: 400, lineHeight: 1.4 },
  "type.label":   { type: "font", family: "IBM Plex Sans", size: 12, weight: 500, lineHeight: 1.3 }
}}
```

Verify: `design_tokens { action: "list" }` shows `color.ground` and `color.ink`.

- [ ] **Step 3: Create catalog frame + header**

```
design_apply { ops: [
  { op: "createFrame", page: "pg_catalog", frame: {
      id: "fr_catalog", name: "Pattern Library",
      x: 0, y: 0, width: 1280, height: 2200,
      fill: "$color.surface", clip: true,
      layout: { direction: "column", gap: "$space.8", padding: ["$space.8", "$space.8"], align: "stretch" }
  }},
  { op: "create", parent: "fr_catalog", node: {
      id: "row_header", type: "frame", name: "Header",
      width: "fill", height: "hug",
      layout: { direction: "column", gap: "$space.3", align: "stretch" }
  }},
  { op: "create", parent: "row_header", node: {
      id: "tx_title", type: "text", name: "Title",
      content: "Pattern Library", font: "$type.display", fill: "$color.text",
      width: "fill", height: "hug"
  }},
  { op: "create", parent: "row_header", node: {
      id: "tx_subtitle", type: "text", name: "Subtitle",
      content: "Nine two-tone motifs — swatches and applied surfaces.",
      font: "$type.body", fill: "$color.muted", width: "fill", height: "hug"
  }},
  { op: "create", parent: "row_header", node: {
      id: "row_swatches", type: "frame", name: "Tone swatches",
      width: "fill", height: "hug",
      layout: { direction: "row", gap: "$space.4", align: "center" }
  }},
  { op: "create", parent: "row_swatches", node: {
      id: "sw_ground", type: "frame", name: "Ground chip",
      width: 48, height: 48, fill: "$color.ground", radius: "$radius.md",
      stroke: { color: "$color.ink", width: 1 }
  }},
  { op: "create", parent: "row_swatches", node: {
      id: "tx_sw_ground", type: "text", name: "Ground label",
      content: "Ground · #F3EEE6", font: "$type.label", fill: "$color.muted", height: "hug"
  }},
  { op: "create", parent: "row_swatches", node: {
      id: "sw_ink", type: "frame", name: "Ink chip",
      width: 48, height: 48, fill: "$color.ink", radius: "$radius.md"
  }},
  { op: "create", parent: "row_swatches", node: {
      id: "tx_sw_ink", type: "text", name: "Ink label",
      content: "Ink · #1E3A4C", font: "$type.label", fill: "$color.muted", height: "hug"
  }}
]}
```

- [ ] **Step 4: Screenshot header**

```
design_screenshot { nodeId: "fr_catalog" }
```

Expected: title, subtitle, two color chips visible; paper surface; no purple theme. If clipped/overlap, `design_inspect { nodeId: "fr_catalog" }` and fix.

- [ ] **Step 5: Commit** — skip unless user asked.

---

### Task 2: Geometric motif row (Dot, Hatch, Hex)

**Files:**
- MCP only on `patterns.design.json`

**Interfaces:**
- Consumes: `fr_catalog`, `$color.ground`, `$color.ink`
- Produces: `row_geo`, swatches `fr_swatch_dot` / `fr_swatch_hatch` / `fr_swatch_hex` (200×200 clipped absolute pattern frames + labels)

**Swatch shell pattern** (repeat for each motif): outer column = tile + label; tile = clipped frame `width:200, height:200, fill:"$color.ground", clip:true, layout:{mode:"absolute"}` with motif children positioned numerically.

- [ ] **Step 1: Create Geometric section chrome + Dot grid**

Create `row_geo` (column), section title “Geometric”, then a row of three swatch columns.

**Dot grid:** inside `fr_swatch_dot`, place a ~6×6 grid of `ellipse` nodes (diameter ~8, gap ~28), fill `$color.ink`, opacity `0.35`. Ids: `el_dot_00` … `el_dot_55`. Label text `tx_label_dot` = “Dot grid”.

- [ ] **Step 2: Hatch + Hex in same or follow-up apply batch**

**Diagonal hatch (`fr_swatch_hatch`):** ~12 thin `rect`s (`width: 2, height: 280`), fill `$color.ink`, opacity `0.4`, each with `transform.rotate: 35` and staggered `x`. Label “Diagonal hatch”.

**Hex lattice (`fr_swatch_hex`):** grid of `shape` `kind:"polygon", sides:6` (~36×36), fill none / stroke `{color:"$color.ink", width:1}`, opacity `0.45`, spaced to suggest honeycomb. Label “Hex lattice”.

- [ ] **Step 3: Screenshot**

```
design_screenshot { nodeId: "fr_catalog" }
```

Expected: three geometric tiles readable at a glance; ink on ground; labels under tiles. Inspect/fix if motifs look solid blobs or overflow.

- [ ] **Step 4: Commit** — skip unless user asked.

---

### Task 3: Organic motif row (Stipple, Wave, Blob)

**Interfaces:**
- Consumes: `fr_catalog`, tokens
- Produces: `row_org`, `fr_swatch_stipple`, `fr_swatch_wave`, `fr_swatch_blob`

- [ ] **Step 1: Soft stipple**

Irregular scatter of ~25 small ellipses (r 2–5), ink at opacity 0.25–0.5, non-grid `x/y` positions. Label “Soft stipple”.

- [ ] **Step 2: Wave bands**

3–4 horizontal `shape` `kind:"blob"` (or soft rects) stretched wide, low height, ink opacity ~0.2–0.35, slight vertical offset. Label “Wave bands”.

- [ ] **Step 3: Blob scatter**

4–6 `shape` blobs at varied scale (`transform.scale`), ink opacity ~0.3. Label “Blob scatter”.

- [ ] **Step 4: Screenshot + inspect if needed**

Expected: organic row feels softer than geometric; still clearly two-tone; usable density.

- [ ] **Step 5: Commit** — skip unless user asked.

---

### Task 4: Technical motif row (Blueprint, Circuit, Iso)

**Interfaces:**
- Consumes: `fr_catalog`, tokens
- Produces: `row_tech`, `fr_swatch_blueprint`, `fr_swatch_circuit`, `fr_swatch_iso`

- [ ] **Step 1: Blueprint grid**

Fine orthogonal lines: thin `shape` `kind:"line"` or 1px rects every ~20px horizontal + vertical, ink opacity ~0.25; optional corner L-marks. Label “Blueprint grid”.

- [ ] **Step 2: Circuit traces**

Orthogonal path segments (thin rects) + small pad ellipses at junctions; ink opacity ~0.5. Label “Circuit traces”.

- [ ] **Step 3: Isometric cubes**

Small clusters of polygons / rhombi suggesting cubes (or hex+parallelogram composition); sparse, not a full floor. Label “Isometric cubes”.

- [ ] **Step 4: Screenshot**

Expected: all nine swatches present in three labeled rows; technical row reads “drafting / UI chrome” not decoration overload.

- [ ] **Step 5: Commit** — skip unless user asked.

---

### Task 5: Application strip — cards (Dot, Hatch, Hex)

**Interfaces:**
- Consumes: motif construction approach from Task 2 (same child structure, or duplicated motif layers inside larger frames)
- Produces: `row_apps`, subsection `row_app_cards`, apps `fr_app_dot`, `fr_app_hatch`, `fr_app_hex`

- [ ] **Step 1: Application section header**

Under motif grid, create `row_apps` with title “Applied” / subtitle “Same motifs as card, empty state, and hero band backgrounds.”

- [ ] **Step 2: Three content cards (~220×140)**

Each card: clipped frame, pattern fill (same motif as matching swatch), padding, radius `$radius.lg`, optional light stroke. Overlay text on ground scrim or solid label chip:

| Id | Motif | Copy |
|---|---|---|
| `fr_app_dot` | Dot | “Sprint notes” |
| `fr_app_hatch` | Hatch | “Weekly digest” |
| `fr_app_hex` | Hex | “Design critique” |

Text: `$type.title` or `$type.label`, fill `$color.ink`, must remain legible (add 8px solid `$color.ground` label plate if pattern fights contrast).

- [ ] **Step 3: Screenshot**

Expected: three cards; pattern visible but secondary to copy.

- [ ] **Step 4: Commit** — skip unless user asked.

---

### Task 6: Application strip — empty states + hero bands

**Interfaces:**
- Consumes: `row_apps`, organic + technical motifs
- Produces: `fr_app_stipple`, `fr_app_wave`, `fr_app_blob`, `fr_app_blueprint`, `fr_app_circuit`, `fr_app_iso`

- [ ] **Step 1: Empty state panels (Stipple, Wave, Blob)**

~240×160 panels: pattern background + centered muted body “No projects yet” (`$type.body`) + small label chip with motif name. Ids as above.

- [ ] **Step 2: Hero bands (Blueprint, Circuit, Iso)**

~280×72 bands: pattern background + left-aligned product label (“Northwind Ops”, “Trace Console”, “Iso Board”) in `$type.label` / `$type.title` on a ground plate if needed.

- [ ] **Step 3: Final screenshot + inspect**

```
design_screenshot { nodeId: "fr_catalog" }
design_inspect { nodeId: "fr_catalog" }
```

Expected success criteria from spec:
1. Nine swatches + nine applications with clear row labels.
2. Coherent two-tone library (not nine unrelated demos).
3. All application copy legible.

Fix any `issues` from inspect (overlap, clipping, text overflow), then screenshot again.

- [ ] **Step 4: Commit** — skip unless user asked.

---

## Spec coverage checklist

| Spec requirement | Task |
|---|---|
| File `patterns.design.json`, page Catalog, `fr_catalog` | 1 |
| Tokens ground/ink/surface/text + type/space | 1 |
| Header + tone chips | 1 |
| Geometric: Dot, Hatch, Hex | 2 |
| Organic: Stipple, Wave, Blob | 3 |
| Technical: Blueprint, Circuit, Iso | 4 |
| Application cards | 5 |
| Empty states + hero bands | 6 |
| Screenshot / inspect verification | 1–6 |
| Out of scope (SVG export, components, dark mode, densites, Play) | not planned |

## Self-review notes

- No TBD placeholders; token hex values and node ids specified.
- Motif construction is canvas-native (matches Constraints).
- Commits gated on user request (matches repo user rules).
