import * as vscode from "vscode";
import fs from "node:fs";
import path from "node:path";
import { sampleDoc, serialize, withPrimitiveCatalog } from "@cursor-design/core";
import { startHttpMcp, type HttpMcpHandle } from "@cursor-design/mcp";
import { DocumentStore } from "./store";
import { DesignEditorProvider, VIEW_TYPE } from "./editorProvider";
import { ExtensionHost } from "./host";
import { hasCursorApi, installSkillFallback, mcpJsonEntry, registerMcp, registerPluginPath, unregisterMcp, unregisterPluginPath, writeWorkspaceMcpJson } from "./cursorApi";

let mcp: HttpMcpHandle | undefined;
let output: vscode.LogOutputChannel;
let status: vscode.StatusBarItem;

export async function activate(context: vscode.ExtensionContext) {
  // {log:true} → LogOutputChannel, also persisted under the editor's logs folder (readable for debugging)
  output = vscode.window.createOutputChannel("Cursor Design", { log: true });
  const log = (m: string) => (output as vscode.LogOutputChannel).info(m);
  context.subscriptions.push(output);

  const store = new DocumentStore(log);
  const { provider, disposable } = DesignEditorProvider.register(context, store, log);
  context.subscriptions.push(disposable);

  const pluginDir = path.join(context.extensionPath, "plugin");
  const guidePath = path.join(pluginDir, "skills", "cursor-design", "SKILL.md");
  const guide = () => {
    try {
      return withPrimitiveCatalog(fs.readFileSync(guidePath, "utf8"));
    } catch {
      return withPrimitiveCatalog("# Cursor Design\nUse design_list → design_tokens → design_apply → design_screenshot.");
    }
  };
  const host = new ExtensionHost(store, provider, guide, log);

  status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 50);
  status.command = "cursorDesign.showStatus";
  context.subscriptions.push(status);

  const cfg = () => vscode.workspace.getConfiguration("cursorDesign");

  async function startMcp() {
    if (mcp) await mcp.close().catch(() => {});
    mcp = await startHttpMcp(host, { port: cfg().get<number>("mcpPort") ?? 48731, onLog: log });
    let how = "not registered (no Cursor API)";
    const registerUrl = `${mcp.url}?token=${encodeURIComponent(mcp.token)}`; // token in URL as well as header (header may be dropped)
    if (cfg().get<boolean>("autoRegister") !== false && registerMcp(registerUrl, mcp.token)) how = "registered via vscode.cursor.mcp";
    status.text = `$(symbol-color) Design MCP`;
    status.tooltip = `Cursor Design MCP at ${mcp.url} — ${how}`;
    status.show();
    log(`MCP ${mcp.url} ${how}`);
    if (!hasCursorApi()) {
      log("vscode.cursor API not found — running in plain VS Code? Use 'Cursor Design: Write .cursor/mcp.json entry' as a fallback.");
    }
  }

  try {
    await startMcp();
  } catch (e) {
    log(`failed to start MCP: ${(e as Error).message}`);
    vscode.window.showErrorMessage(`Cursor Design: MCP server failed to start: ${(e as Error).message}`);
  }

  if (registerPluginPath(pluginDir)) log(`plugin path registered: ${pluginDir}`);
  else {
    log(`vscode.cursor.plugins.registerPath unavailable — offering skill install to ~/.cursor`);
    const key = "cursorDesign.skillInstallOffered";
    if (!context.globalState.get<boolean>(key)) {
      void vscode.window
        .showInformationMessage("Cursor Design: install the agent skill into ~/.cursor/skills so the Cursor agent knows how to use the canvas?", "Install", "Later")
        .then(async (choice) => {
          if (choice === "Install") {
            const w = await installSkillFallback(pluginDir);
            log(`skill fallback wrote: ${w.join(", ") || "(up to date)"}`);
            vscode.window.showInformationMessage(`Cursor Design skill installed (${w.length} file(s)).`);
            await context.globalState.update(key, true);
          } else if (choice === "Later") await context.globalState.update(key, true);
        });
    }
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("cursorDesign.newFile", async () => {
      const root = vscode.workspace.workspaceFolders?.[0]?.uri;
      const name = await vscode.window.showInputBox({ prompt: "Design file name", value: "app.design.json", validateInput: (v) => (v.endsWith(".design.json") ? undefined : "must end with .design.json") });
      if (!name) return;
      const uri = root ? vscode.Uri.joinPath(root, name) : undefined;
      if (!uri) return vscode.window.showErrorMessage("Open a folder first.");
      try {
        await vscode.workspace.fs.stat(uri);
        return vscode.window.showErrorMessage(`${name} already exists.`);
      } catch {
        /* ok */
      }
      await vscode.workspace.fs.writeFile(uri, Buffer.from(serialize(sampleDoc(name.replace(/\.design\.json$/, ""))), "utf8"));
      await vscode.commands.executeCommand("vscode.openWith", uri, VIEW_TYPE);
    }),
    vscode.commands.registerCommand("cursorDesign.openAsText", async (uri?: vscode.Uri) => {
      const target = uri ?? store.active()?.uri;
      if (target) await vscode.commands.executeCommand("vscode.openWith", target, "default");
    }),
    vscode.commands.registerCommand("cursorDesign.reconnectMcp", async () => {
      await startMcp();
      vscode.window.showInformationMessage(`Cursor Design MCP re-registered at ${mcp?.url}. If Cursor still shows 0 tools, toggle the server off/on in Settings → Tools & MCP.`);
    }),
    vscode.commands.registerCommand("cursorDesign.copyMcpConfig", async () => {
      if (!mcp) return;
      await vscode.env.clipboard.writeText(JSON.stringify({ mcpServers: mcpJsonEntry(mcp.url, mcp.token) }, null, 2));
      vscode.window.showInformationMessage("MCP config copied to clipboard.");
    }),
    vscode.commands.registerCommand("cursorDesign.writeMcpConfig", async () => {
      if (!mcp) return;
      const f = await writeWorkspaceMcpJson(mcp.url, mcp.token);
      if (f) vscode.window.showInformationMessage(`Wrote ${vscode.workspace.asRelativePath(f)} (note: the token rotates on each activation unless the port is fixed).`);
    }),
    vscode.commands.registerCommand("cursorDesign.debugLayout", () => {
      const e = store.active();
      if (!e) return vscode.window.showWarningMessage("Open a design file first.");
      provider.debugLayout(e.uri);
      output.show(true);
      log(`[layout] requested for ${e.uri.fsPath}; doc fr children: ${JSON.stringify(Object.values(e.doc.nodes).filter((n) => n.type === "frame").map((n) => [n.id, (n as { children: string[] }).children]))}`);
    }),
    vscode.commands.registerCommand("cursorDesign.installSkill", async () => {
      const w = await installSkillFallback(pluginDir);
      vscode.window.showInformationMessage(w.length ? `Installed: ${w.join(", ")}` : "Skill already up to date in ~/.cursor");
    }),
    vscode.commands.registerCommand("cursorDesign.showStatus", () => {
      output.show(true);
      log(`status: mcp=${mcp?.url ?? "down"} cursorApi=${hasCursorApi()} open=${store.all().map((e) => e.uri.fsPath).join(", ") || "none"}`);
    }),
  );

  context.subscriptions.push({
    dispose: () => {
      unregisterMcp();
      unregisterPluginPath(pluginDir);
      mcp?.close().catch(() => {});
    },
  });

  // Test/automation API (not a public contract yet)
  return {
    getMcp: () => (mcp ? { url: mcp.url, token: mcp.token } : undefined),
    openDocuments: () => store.all().map((e) => e.uri.fsPath),
    hasCursorApi,
  };
}

export function deactivate() {
  unregisterMcp();
  return mcp?.close();
}
