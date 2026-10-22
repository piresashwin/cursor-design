# Aesthetics (anti-slop)

Synthesized from Taste Skill, Impeccable, Anthropic frontend-design — rewritten for the canvas.

## Before `design_apply`

Write one **design read** (silently or in a short note): subject · audience · mode · one differentiator.  
If the plan looks like the same UI you’d ship for any SaaS brief, revise the differentiator first.

## Hard bans (unless the brief explicitly asks)

- Purple-on-white or purple→indigo gradient as the whole theme
- Warm cream `#F4F1EA`-ish + terracotta accent + high-contrast serif as a default “tasteful” look
- Broadsheet: hairline rules, zero radius, dense newspaper columns as a default
- Identical rounded cards with the same soft gray shadow filling the whole screen
- Inter / Roboto / Arial / system-ui as the *display* personality when `$type.*` tokens exist (body may stay practical)
- Nested cards (card inside card) as the primary structure
- ALL-CAPS tracked eyebrows above every heading; `Word · Word · Word` meta rows as decoration
- Pure `#000` / `#fff` for large fields — tint neutrals toward the brand hue
- Gray text on colored backgrounds (contrast failure)
- Lorem ipsum — use product-shaped copy, plausible names and numbers
- `name: "frame"` / type-as-name

## Spend boldness once

One memorable element (hero, type lockup, data moment). Everything else stays quiet. Cut accessories that don’t serve the brief.

## Color commitment (pick one)

| Strategy | When |
|---|---|
| **Restrained** | Operate / Read — neutrals + accent ≤10% |
| **Committed** | Persuade identity pages — one hue owns 30–60% |
| **Full palette** | Data viz, campaigns — 3–4 named roles used on purpose |
| **Drenched** | Heroes / experience — the surface *is* the color |

## Type

- Prefer token fonts (`$type.display`, `$type.body`, `$type.label`)
- One family, or two clearly distinct roles — not a random mix
- Avoid accenting a single word in a headline with italic/color as a default trick
- Cap body-ish text around ~65ch when the artboard is wide

## Copy

- CTAs say what happens: “Save changes”, not “Submit”
- Empty / error states give a next action
- Same action keeps the same verb through the flow
