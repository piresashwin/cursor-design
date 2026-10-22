# Layout structure (containers before coordinates)

Give structure control — not just `x`/`y`. Prefer auto-layout frames; use absolute only for overlays inside a clipped card.

## Checklist (before every section batch)

1. **Container first** — create/update a `frame` with `layout: { direction, gap, padding, align, justify }`.
2. **Size the children** — `fill` (share free space), `hug` (content), or fixed number. Sibling `fill` on the main axis should share evenly.
3. **One job per section** — group by semantic purpose (`Header`, `Metric row`, `Tab bar`), then reorder with `move` / `index`.
4. **Absolute last** — only for scrims, badges, stacked media. Parent needs `layout.mode:"absolute"` (or is top-level) and usually `clip:true`.
5. **Verify** — `design_screenshot` + `design_inspect` on the frame. Fix overlaps / clipping / text-overflow from the inspect issues list.

## Layout props

| Prop | Values | Use |
|---|---|---|
| `direction` | `row` \| `column` | Main axis |
| `gap` / `padding` | number or `$space.*` | Rhythm — prefer tokens |
| `align` | `start` \| `center` \| `end` \| `stretch` | Cross axis |
| `justify` | `start` \| `center` \| `end` \| `space-between` | Main-axis distribution |
| `mode` | `flex` (default) \| `absolute` | Absolute = children honor `x`/`y` |

No CSS grid yet — emulate columns with nested row/column frames + equal `fill` or fixed widths.

## Sizing

| Size | Meaning |
|---|---|
| `"fill"` | Grow on the parent’s main axis (`flex 1 1 0%`); stretch on the cross axis |
| `"hug"` | Fit content |
| `number` | Fixed px (tabs often use equal fixed widths when labels differ) |

## Semantic grouping

```
create frame "Hero" → children: media, copy, CTA row
move CTA into "Hero actions" row (gap + fill buttons)
```

Don’t leave orphan absolute nodes on the artboard when a flex section would do.

## Inspect loop

After a risky layout batch:

```
design_inspect { nodeId: <frameId> }
→ read summary.issues (overlap | clipped | text-overflow | zero-size)
→ design_apply fixes
→ design_screenshot
```

`depth` (default 4) limits how deep the subtree is measured.
