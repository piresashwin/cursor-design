# Data visualization playbook

Goal: stop defaulting to a stock axis bar/line chart for every metric.

## Decision tree

1. **Single KPI + trend?** → big number text + `chart` `sparkline` (no axes) beside or under it. Optional delta text.
2. **Completion / quota / score 0–100%?** → `progress` linear or circular (gauge). Not a donut of fake categories.
3. **Ranked list (top N)?** → rows of label + `progress` linear (or hug text + bar width). Prefer this over a categorical bar chart when labels matter.
4. **Part-of-whole with ≤5 slices?** → `donut` *or* a horizontal stack of labeled segments. Don’t use a donut for time series.
5. **True multi-point time series / comparison needing scale?** → `chart` `bar` | `line` | `area` with axes.
6. **Loading?** → `skeleton`, not a fake chart.
7. **Heat / matrix / custom?** → compose a **grid of frames** with token fills (opacity or stepped colors). This is allowed and preferred when no chart kind fits.

## Chart style (when you do use `chart`)

Prefer non-Excel defaults:

```json
{ "options": { "chrome": "minimal", "rounded": true, "highlight": 3, "goal": 100, "valueLabels": "last" } }
```

| Option | Effect |
|---|---|
| `chrome: "minimal"` | Category labels; no Y axis (dashboard default) |
| `chrome: "none"` | Bare marks — sparklines / embedded cards |
| `chrome: "full"` | Classic axes + grid |
| `rounded` | Soft bar corners |
| `strokeWidth` / `fillOpacity` / `showDots` | Line/area weight |
| `goal` | Dashed target line |
| `highlight` | Emphasize one category index |
| `valueLabels: "last"` | Label the end point / last bar |
| `stacked` | Stack multi-series bar/area |

## Rules

- Use a real `chart` node for series plots — don’t fake *time series* with hand-placed rects.
- **Do** compose gauges, ranks, KPI strips, and heat grids from frames / progress / text / sparkline.
- Prefer **small multiples** (several sparklines) over one crowded multi-series line when comparing entities.
- Match viz chrome to mode: Operate → `chrome:"minimal"`; Persuade → KPI + sparkline or `chrome:"none"`.
- Colors from `$color.*` tokens; series accents should remain readable on the surface fill.
