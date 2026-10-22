# Cursor Design

An open-source, Cursor-native design canvas. Chat with the Cursor agent to generate screens and flows; refine them visually in a Figma-like editor; keep the design file (`*.design.json`) in git next to the code.

**Status: Phase 0c spike.** See [PLAN.md](PLAN.md) for the research, product definition and roadmap, and [mockups/](mockups/) for the click-through UX.

## Layout

```
packages/core      document schema (zod), applyOps reducer with inverse ops, stable serializer, sample doc
packages/mcp       design_* MCP tools, streamable-HTTP server (127.0.0.1 + bearer), disk-backed host
packages/editor    React webview: DOM-rendered frames, pan/zoom, pages tree, properties, html-to-image screenshots
apps/extension     Cursor/VS Code extension: custom editor for *.design.json, in-process MCP, registers with
                   vscode.cursor.mcp.registerServer + vscode.cursor.plugins.registerPath (SKILL.md + rule)
apps/cli           cursor-design new | validate | mcp (stdio) | render (headless PNG via Chrome/Playwright)
examples/          pulse.design.json
mockups/           Phase 0a click-through (Vite)
```

## Build & run

```bash
pnpm install
pnpm run build          # core → mcp → editor → extension → cli
pnpm run test           # core ops, MCP over HTTP, editor headless (needs Playwright; see PLAYWRIGHT_MODULE)
```

### Try it in Cursor (Extension Development Host)

1. Run `pnpm dev:cursor` (launches Cursor with `--extensionDevelopmentPath`, opened on `examples/`). Pressing **F5** also works, but only if the folder is open in Cursor — in VS Code, F5 launches VS Code.
2. Open `pulse.design.json` — it opens in the Cursor Design editor.
3. Check **Settings → Tools & MCP**: a `cursor-design` server should be listed with 8 tools. If it shows 0 tools, toggle it off/on (known Cursor bug) or run **Cursor Design: Reconnect MCP server**.
4. In chat: *"Add a blue button under the password field on the Login frame, then screenshot it."* The agent should call `design_guide` / `design_tokens` / `design_apply` / `design_screenshot`; the button appears live in the editor.

Or install the package into Cursor: `pnpm run package && pnpm install:cursor` (or *Extensions: Install from VSIX*).

### Outside Cursor (plain VS Code / CLI)

The extension still runs; register the MCP server manually with **Cursor Design: Write .cursor/mcp.json entry**, or use the CLI's stdio server over files on disk:

```bash
node apps/cli/dist/cli.js mcp .            # stdio MCP (no screenshots)
node apps/cli/dist/cli.js render examples/pulse.design.json --frame fr_login --out login.png
```
