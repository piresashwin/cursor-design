# Pattern Library (motif + application) — Design Spec

**Date:** 2026-10-22  
**Medium:** Cursor Design canvas (`patterns.design.json`)  
**Status:** Approved in conversation; awaiting user review of this written spec

## Goal

Ship a reusable **pattern library** prototype: nine two-tone motifs across three visual families, each shown as a swatch and again applied to a small UI surface so reuse is visible.

## Constraints (canvas)

- Motifs are **composed** from Cursor Design primitives (`rect`, `ellipse`, `shape`, clipped frames with absolute tiled children) — not raw SVG `<pattern>` / path markup.
- Single two-tone system shared by every tile: ground + ink.
- Mode: **read** (catalog chrome, quiet hierarchy).
- New file only; do not restyle existing example designs (Pulse, Meridian, etc.).

## File & board

| Item | Value |
|---|---|
| File | `patterns.design.json` |
| Page | `pg_catalog` · Catalog |
| Primary frame | `fr_catalog` — tall artboard (~1280 × ~2200) holding header, motif grid, application strip |

### Zones (top → bottom)

1. **Header** — Title “Pattern Library”, one-line subtitle, two swatches labeled Ground / Ink.
2. **Motif grid** — Three labeled rows × three 200×200 tiles with caption under each.
3. **Application strip** — Nine mini UIs (same motif order) proving background reuse.

## Tokens

| Token | Role | Direction |
|---|---|---|
| `color.ground` | Pattern ground / page bg | Warm off-white (paper) |
| `color.ink` | Motif stroke/fill | Deep slate-blue (not pure black) |
| `color.surface` | Non-pattern chrome if needed | Slightly cooler/lighter than ground |
| `color.text` | Labels | Ink or ink at high opacity |
| `space.*` / `radius.*` / `type.*` | Layout + type | Compact catalog scale |

No third accent color in v1.

## Motif lineup (9)

### Geometric

| Id slug | Name | Construction |
|---|---|---|
| `dot` | Dot grid | Even ellipse grid, low opacity ink |
| `hatch` | Diagonal hatch | Thin rotated lines / thin rects |
| `hex` | Hex lattice | Polygon hex tiles or composed edges |

### Organic

| Id slug | Name | Construction |
|---|---|---|
| `stipple` | Soft stipple | Irregular small ellipses (seeded scatter) |
| `wave` | Wave bands | Horizontal undulating bands (blobs/rects + transform) |
| `blob` | Blob scatter | Few `shape` blobs at varied scale/opacity |

### Technical

| Id slug | Name | Construction |
|---|---|---|
| `blueprint` | Blueprint grid | Fine orthogonal grid + light margin marks |
| `circuit` | Circuit traces | Orthogonal trace lines + pad ellipses |
| `iso` | Isometric cubes | Small rhombus / polygon stack suggesting cubes |

Density target: usable as **UI background** (readable over content), not wallpaper noise.

## Application strip

Same motif order as the grid. Grouping by UI type:

| Motifs | Applied as | Example copy |
|---|---|---|
| Dot, Hatch, Hex | Content **card** (~220×140) | “Sprint notes” |
| Stipple, Wave, Blob | **Empty state** panel | “No projects yet” |
| Blueprint, Circuit, Iso | Narrow **hero band** | Product-shaped header label |

Pattern stays secondary: text/chrome contrast must remain readable (ink text on ground, or scrim if needed).

## Naming conventions

Follow Cursor Design naming:

- Frames: `fr_catalog`, `fr_swatch_dot`, `fr_app_dot`, …
- Text: `tx_title`, `tx_label_dot`, …
- Motif layers: `el_dot_00`, `sh_blob_01`, … with Title Case human `name`s

## Out of scope (v1)

- True SVG export / `<pattern>` units
- Component promotion of each motif (defer until winners are clear)
- Dark mode token set
- Density variants (sparse / dense) as separate tiles
- Interactive Play flows between screens

## Success criteria

1. One open design file shows all nine swatches + nine applications without scrolling chaos (clear row labels).
2. Screenshot of `fr_catalog` reads as a coherent two-tone library, not nine unrelated demos.
3. Each application mock remains legible with the pattern behind it.

## Implementation notes (for planning)

1. Create design file / page / tokens first.
2. Build header → geometric row → organic → technical (screenshot after each row).
3. Build application strip in three batches (cards, empty states, hero bands).
4. Final `design_screenshot` + `design_inspect` on `fr_catalog`.
