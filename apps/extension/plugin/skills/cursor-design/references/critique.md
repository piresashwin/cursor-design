# Critique intents

When the user asks to polish, quiet, bold, or distill a selection — treat these as **ops intents**, not chat essays. Prefer `design_get_selection` → targeted `design_apply` → `design_screenshot`.

| Intent | Do |
|---|---|
| **polish** | Fix spacing rhythm (`gap`/`padding` tokens), type hierarchy, contrast, naming; align radii/shadows to tokens |
| **quieter** | Reduce accent area, remove decorative strokes/shadows, collapse nested chrome, prefer Restrained color |
| **bolder** | One stronger hero (type, media, or data moment); increase commitment without adding clutter |
| **distill** | Delete non-essential nodes; one job per section; keep only what the brief needs |
| **clarify** | Rewrite labels/CTAs/empty states for plain language and consistent verbs |
| **harden** | Empty/overflow paths: longer labels, skeleton for loading, hug vs fill for variable text |

## Rules

- Don’t redesign identity under polish — refine in place unless asked.
- Don’t add motion for its own sake; canvas motion is `transform` / opacity / link transitions only.
- After each intent batch, screenshot the affected frame.
