import * as vscode from "vscode";
import { randomBytes } from "node:crypto";
import { startHttpMcp, type DesignHost, type HttpMcpHandle } from "@cursor-design/mcp";
import { hasCursorApi, mcpJsonEntry, registerMcp, unregisterMcp, writeWorkspaceMcpJson } from "../cursorApi";

export type McpStatus = { url: string; token: string } | undefined;

const TOKEN_KEY = "cursorDesign.mcpToken";

/**
 * Owns MCP HTTP lifecycle + Cursor registration. Composition root wires this;
 * commands call start/reconnect/copy without knowing transport details.
 */
export class McpService implements vscode.Disposable {
  private handle: HttpMcpHandle | undefined;

  constructor(
    private readonly host: DesignHost,
    private readonly status: vscode.StatusBarItem,
    private readonly log: (m: string) => void,
    private readonly globalState?: vscode.Memento,
  ) {}

  get url(): string | undefined {
    return this.handle?.url;
  }

  get snapshot(): McpStatus {
    return this.handle ? { url: this.handle.url, token: this.handle.token } : undefined;
  }

  /** Reuse a stable token so Cursor's registered URL keeps working across reloads. */
  private async resolveToken(): Promise<string> {
    const cfg = vscode.workspace.getConfiguration("cursorDesign");
    const fromCfg = cfg.get<string>("mcpToken")?.trim();
    if (fromCfg) return fromCfg;
    const stored = this.globalState?.get<string>(TOKEN_KEY);
    if (stored) return stored;
    const token = randomBytes(24).toString("base64url");
    await this.globalState?.update(TOKEN_KEY, token);
    return token;
  }

  private async publish(url: string, token: string): Promise<string> {
    const cfg = vscode.workspace.getConfiguration("cursorDesign");
    if (cfg.get<boolean>("writeMcpJson") !== false) {
      const f = await writeWorkspaceMcpJson(url, token).catch((e) => {
        this.log(`mcp.json write failed: ${(e as Error).message}`);
        return undefined;
      });
      if (f) this.log(`wrote ${vscode.workspace.asRelativePath(f)}`);
    }

    let how = "mcp.json only (no Cursor API)";
    const registerUrl = `${url}?token=${encodeURIComponent(token)}`;
    if (cfg.get<boolean>("autoRegister") !== false) {
      // Drop any stale lease, then re-register so idle-suspend / EDH reload
      // don't leave Agent stuck on "Timed out waiting for connection".
      unregisterMcp();
      if (registerMcp(registerUrl, token)) how = "registered via vscode.cursor.mcp + mcp.json";
    }
    return how;
  }

  /**
   * Start (or soft-reconnect) the MCP HTTP server and publish it to Cursor.
   * Pass `forceRestart: true` to bounce the listener; default keeps it up so
   * Cursor does not hit ECONNREFUSED during reconnect.
   */
  async start(opts?: { forceRestart?: boolean }): Promise<void> {
    const cfg = vscode.workspace.getConfiguration("cursorDesign");
    const token = await this.resolveToken();
    const wantPort = cfg.get<number>("mcpPort") ?? 48731;

    if (this.handle && !opts?.forceRestart) {
      const how = await this.publish(this.handle.url, this.handle.token);
      this.status.text = `$(symbol-color) Design MCP`;
      this.status.tooltip = `Cursor Design MCP at ${this.handle.url} — ${how} (soft reconnect)`;
      this.status.show();
      this.log(`MCP soft-reconnect ${this.handle.url} ${how}`);
      return;
    }

    if (this.handle) await this.handle.close().catch(() => {});
    this.handle = await startHttpMcp(this.host, {
      port: wantPort,
      token,
      onLog: this.log,
    });

    const how = await this.publish(this.handle.url, this.handle.token);
    this.status.text = `$(symbol-color) Design MCP`;
    this.status.tooltip = `Cursor Design MCP at ${this.handle.url} — ${how}`;
    this.status.show();
    this.log(`MCP ${this.handle.url} ${how}`);
    if (!hasCursorApi()) {
      this.log("vscode.cursor API not found — rely on .cursor/mcp.json (written above).");
    }
  }

  /** Local round-trip: health → initialize → tools/list → design_list. */
  async diagnose(): Promise<string> {
    if (!this.handle) return "MCP server is not running.";
    const base = this.handle.url;
    const token = this.handle.token;
    const lines: string[] = [`url: ${base}`, `sessions probe…`];
    const t0 = Date.now();
    try {
      const health = await fetch(`http://127.0.0.1:${this.handle.port}/health`);
      lines.push(`health: ${health.status} ${await health.text()}`);

      const auth = {
        Authorization: `Bearer ${token}`,
        Accept: "application/json, text/event-stream",
        "Content-Type": "application/json",
      };
      const initRes = await fetch(base, {
        method: "POST",
        headers: auth,
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "cursor-design-diagnose", version: "0" } },
        }),
      });
      const sid = initRes.headers.get("mcp-session-id");
      lines.push(`initialize: ${initRes.status} session=${sid ?? "none"}`);
      if (!sid) {
        lines.push(`body: ${(await initRes.text()).slice(0, 200)}`);
        return lines.join("\n");
      }

      const h = { ...auth, "mcp-session-id": sid };
      const listRes = await fetch(base, {
        method: "POST",
        headers: h,
        body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
      });
      const listBody = (await listRes.json()) as { result?: { tools?: { name: string }[] } };
      const tools = listBody.result?.tools?.map((t) => t.name) ?? [];
      lines.push(`tools/list: ${listRes.status} count=${tools.length} [${tools.slice(0, 5).join(", ")}…]`);

      const callRes = await fetch(base, {
        method: "POST",
        headers: h,
        body: JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "design_list", arguments: {} } }),
      });
      const callText = await callRes.text();
      lines.push(`design_list: ${callRes.status} bytes=${callText.length}`);
      lines.push(`ok in ${Date.now() - t0}ms`);
      lines.push(
        "If Agent still times out: run Reconnect MCP, then toggle cursor-design in Settings → Tools & MCP. Cursor idle-suspends HTTP MCP after ~10m; resume can fail until re-register.",
      );
    } catch (e) {
      lines.push(`diagnose error: ${(e as Error).message}`);
    }
    return lines.join("\n");
  }

  async copyConfig(): Promise<void> {
    if (!this.handle) return;
    await vscode.env.clipboard.writeText(JSON.stringify({ mcpServers: mcpJsonEntry(this.handle.url, this.handle.token) }, null, 2));
    vscode.window.showInformationMessage("MCP config copied to clipboard.");
  }

  async writeWorkspaceConfig(): Promise<void> {
    if (!this.handle) return;
    const f = await writeWorkspaceMcpJson(this.handle.url, this.handle.token);
    if (f) {
      vscode.window.showInformationMessage(`Wrote ${vscode.workspace.asRelativePath(f)}.`);
    }
  }

  dispose(): void {
    unregisterMcp();
    void this.handle?.close().catch(() => {});
    this.handle = undefined;
  }
}
