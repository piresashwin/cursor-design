# Draft mockups

Phase 0a click-through — **one first-run journey**, with full **System** workflows.

```bash
cd mockups
npm install
npm run dev
```

Open **http://127.0.0.1:5173/**

## Journey

| Step | Route | Intent |
|---|---|---|
| 01 Welcome | `#/` | Brand + 10-minute arc |
| 02 System | `#/system`… | Foundations (see below) |
| 03 Board | `#/board` → `#/board/live` | Folders → pages → frames; one page at a time; Cursor prompt dock; activity log |
| 04 Review | `#/review` | One **Send to Cursor** |
| 05 Ship | `#/ship` | Theme + screens landed |

## System workflows (click-through)

| Route | Workflow |
|---|---|
| `#/system` | **WF2** Entry fork — Import / Blank / Agent |
| `#/system/import` | **WF3** Tailwind preview → merge/replace |
| `#/system/generate` | **WF5** Brief → Send to Cursor → review |
| `#/system/workspace` | **WF6–11** Edit roles, preview, where-used, delete guard |
| `#/system/export` | **WF15** Export theme → continue Ship |

Blank seed: `#/system/workspace?seed=blank` (Continue gated until Accent is set).

## Editor shell notes

- **Hierarchy:** folders → pages → frames (Figma model). Selecting a page switches the board; selecting a frame selects it. Drag pages onto folders, frames onto pages. `src/board/doc.ts` mirrors PLAN.md §3.2 (single-direction refs).
- **Narrow editor groups:** below 1100 px the Pages / Properties / Activity panels become overlay drawers (toolbar toggles). The board is always visible.
- **Dark chrome:** toggle in the journey nav (follows `prefers-color-scheme` by default). Chrome colors are semantic vars in `index.css` `:root` / `:root[data-theme="dark"]`, to be mapped onto VS Code theme vars at port time.
- **Fonts** are bundled via `@fontsource` (no Google Fonts; webview CSP-safe).
- **Overlays never cover artboards:** the Cursor prompt / next-step dock sits at the bottom; the annotation composer lives in the right panel.

Spec: [`docs/system-workflows.md`](../docs/system-workflows.md)
