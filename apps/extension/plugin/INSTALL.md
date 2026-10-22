# Cursor Design — installation guide

Install the extension, then connect an agent (Cursor, Claude Code, or another MCP client) to the `design_*` tools.

## 1. Install the extension (Cursor or VS Code)

### From a shared `.vsix` (testers)

1. Get `cursor-design.vsix` from a teammate or release.
2. In **Cursor** (recommended) or **VS Code**:
   - Extensions view → `…` → **Install from VSIX…** → pick the file  
   - or from a terminal:
     ```bash
     cursor --install-extension /path/to/cursor-design.vsix
     # VS Code:
     code --install-extension /path/to/cursor-design.vsix
     ```
3. Reload the window.

### Build the `.vsix` yourself (maintainers / sharing with colleagues)

From the monorepo root:

```bash
pnpm install
pnpm package
```

That writes `cursor-design.vsix` at the repo root. Send that file (Slack, Drive, email, GitHub Release). Recipients install it as above.

Local Extension Development Host (no VSIX):

```bash
pnpm dev:cursor
```

## 2. First run in Cursor

1. Open a project folder.
2. Command Palette → **Cursor Design: New design file** (or open an existing `*.design.json`).
3. Confirm the status bar shows **Design MCP**.
4. If prompted, **Install** the agent skill into `~/.cursor/skills` (needed when Cursor’s plugin API isn’t available). You can also run **Cursor Design: Install agent skill into ~/.cursor** anytime.

The Cursor agent should then see the `cursor-design` skill and the MCP tools (`design_list`, `design_tokens`, `design_apply`, `design_screenshot`, …).

### MCP not showing / “0 tools”

- Run **Cursor Design: Reconnect MCP server**.
- Or Settings → **Tools & MCP** → toggle the `cursor-design` server off/on.
- Run **Cursor Design: Show status** and check the **Cursor Design** output channel.

## 3. VS Code notes

The canvas (custom editor for `*.design.json`) works in plain VS Code. Auto-registration via `vscode.cursor.mcp` does **not** — that API is Cursor-only.

In VS Code you can still:

- Edit designs visually.
- Fall back with **Cursor Design: Write `.cursor/mcp.json` entry** or **Copy MCP config**, then point a compatible MCP client at the local URL (extension must stay running).

For a full agent loop without Cursor, prefer the CLI (next section).

## 4. Claude Code (and other MCP clients)

Use the **CLI stdio** MCP server. It edits `*.design.json` on disk; no Cursor window required.

### Build the CLI

```bash
pnpm --filter @cursor-design/cli build
```

Binary: `apps/cli/dist/cli.js` (or `cursor-design` on `PATH` after linking).

### Claude Code config

Add to the project `.mcp.json` (or your user Claude MCP config):

```json
{
  "mcpServers": {
    "cursor-design": {
      "command": "node",
      "args": [
        "/ABSOLUTE/PATH/TO/cursor-design/apps/cli/dist/cli.js",
        "mcp",
        "/ABSOLUTE/PATH/TO/YOUR/PROJECT"
      ]
    }
  }
}
```

If `cursor-design` is on your `PATH`:

```json
{
  "mcpServers": {
    "cursor-design": {
      "command": "cursor-design",
      "args": ["mcp", "."]
    }
  }
}
```

Restart Claude Code / reload MCP. Teach the agent the workflow by copying `skills/cursor-design/SKILL.md` into Claude’s skills or project instructions.

**Limits of the CLI path:** no live board sync; webview `design_screenshot` isn’t available. For PNGs use:

```bash
cursor-design render app.design.json --frame fr_home --out frame.png
```

### Optional: live canvas over HTTP

With the extension open in Cursor/VS Code:

1. **Cursor Design: Copy MCP config** (URL + bearer token).
2. Paste into the MCP client as an HTTP/SSE server.

The design file must stay open for screenshots; the token can rotate when the extension restarts.

## 5. Useful commands

| Command | Purpose |
|---|---|
| Cursor Design: New design file | Create `*.design.json` and open the canvas |
| Cursor Design: Reconnect MCP server | Re-bind Cursor to the local MCP |
| Cursor Design: Install agent skill into ~/.cursor | Copy skill + rule for the agent |
| Cursor Design: Copy MCP config | Clipboard JSON for other clients |
| Cursor Design: Write `.cursor/mcp.json` entry | Workspace fallback for MCP URL |
| Cursor Design: Show status | Log URL, Cursor API, open files |

## 6. What’s in this plugin folder

| Path | Role |
|---|---|
| `skills/cursor-design/SKILL.md` | Agent workflow + document schema |
| `rules/cursor-design.mdc` | Prefer MCP over hand-editing `*.design.json` |
| `INSTALL.md` | This guide |

On Cursor builds with `vscode.cursor.plugins.registerPath`, this folder is registered automatically. Otherwise use the skill-install command above.
