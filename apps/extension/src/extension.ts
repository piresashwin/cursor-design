import * as vscode from "vscode";
import fs from "node:fs";
import path from "node:path";
import { withPrimitiveCatalog } from "@cursor-design/core";
import { DocumentStore } from "./store";
import { DesignEditorProvider } from "./editorProvider";
import { ExtensionHost } from "./host";
import { hasCursorApi, installSkillFallback, registerPluginPath, unregisterMcp, unregisterPluginPath } from "./cursorApi";
import { McpService } from "./services/McpService";
import { PreviewService } from "./services/PreviewService";
import { registerCommands } from "./commands/registerCommands";

let mcp: McpService | undefined;

/**
 * Composition root: wire services, register commands, dispose cleanly.
 * Feature logic lives in services/ + commands/ + adapters/.
 */
export async function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel("Cursor Design", { log: true });
  const log = (m: string) => output.info(m);
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

  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 50);
  status.command = "cursorDesign.showStatus";
  context.subscriptions.push(status);

  mcp = new McpService(host, status, log, context.globalState);
  const preview = new PreviewService(context.extensionPath, store, log);
  context.subscriptions.push(mcp, preview);

  try {
    await mcp.start();
  } catch (e) {
    log(`failed to start MCP: ${(e as Error).message}`);
    vscode.window.showErrorMessage(`Cursor Design: MCP server failed to start: ${(e as Error).message}`);
  }

  // Prefer Cursor plugin-path registration; always keep ~/.cursor/skills in sync so
  // Agent chats pick up the bundled skill even when registerPath is unavailable or stale.
  if (registerPluginPath(pluginDir)) log(`plugin path registered: ${pluginDir}`);
  else log(`vscode.cursor.plugins.registerPath unavailable — relying on ~/.cursor/skills fallback`);
  try {
    const w = await installSkillFallback(pluginDir);
    if (w.length) log(`skill synced to ~/.cursor (${w.length} file(s))`);
  } catch (e) {
    log(`skill sync failed: ${(e as Error).message}`);
  }

  context.subscriptions.push(
    ...registerCommands({ store, provider, mcp, preview, pluginDir, output, log }),
    {
      dispose: () => {
        unregisterPluginPath(pluginDir);
      },
    },
  );

  return {
    getMcp: () => mcp?.snapshot,
    openDocuments: () => store.all().map((e) => e.uri.fsPath),
    hasCursorApi,
  };
}

export function deactivate() {
  unregisterMcp();
  mcp?.dispose();
  mcp = undefined;
}
