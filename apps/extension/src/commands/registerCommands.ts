import * as vscode from "vscode";
import { sampleDoc, serialize } from "@cursor-design/core";
import { hasCursorApi, installSkillFallback } from "../cursorApi";
import { VIEW_TYPE, type DesignEditorProvider } from "../editorProvider";
import type { DocumentStore } from "../store";
import type { McpService } from "../services/McpService";
import type { PreviewService } from "../services/PreviewService";

export type CommandDeps = {
  store: DocumentStore;
  provider: DesignEditorProvider;
  mcp: McpService;
  preview: PreviewService;
  pluginDir: string;
  output: vscode.LogOutputChannel;
  log: (m: string) => void;
};

/** Register all Cursor Design commands. Returns disposables for the composition root. */
export function registerCommands(deps: CommandDeps): vscode.Disposable[] {
  const { store, provider, mcp, preview, pluginDir, output, log } = deps;

  return [
    vscode.commands.registerCommand("cursorDesign.newFile", async () => {
      const root = vscode.workspace.workspaceFolders?.[0]?.uri;
      const name = await vscode.window.showInputBox({
        prompt: "Design file name",
        value: "app.design.json",
        validateInput: (v) => (v.endsWith(".design.json") ? undefined : "must end with .design.json"),
      });
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
      // Soft by default: re-publish without bouncing HTTP (avoids ECONNREFUSED
      // while Cursor's client only retries twice, then sticks on "Timed out").
      await mcp.start();
      vscode.window.showInformationMessage(
        `Cursor Design MCP re-registered at ${mcp.url}. If Agent still times out, toggle cursor-design off/on in Settings → Tools & MCP.`,
      );
    }),

    vscode.commands.registerCommand("cursorDesign.diagnoseMcp", async () => {
      output.show(true);
      log("diagnoseMcp…");
      const report = await mcp.diagnose();
      log(report);
      vscode.window.showInformationMessage("MCP diagnose finished — see Cursor Design output.");
    }),

    vscode.commands.registerCommand("cursorDesign.copyMcpConfig", () => mcp.copyConfig()),

    vscode.commands.registerCommand("cursorDesign.writeMcpConfig", () => mcp.writeWorkspaceConfig()),

    vscode.commands.registerCommand("cursorDesign.debugLayout", () => {
      const e = store.active();
      if (!e) return vscode.window.showWarningMessage("Open a design file first.");
      provider.debugLayout(e.uri);
      output.show(true);
      log(
        `[layout] requested for ${e.uri.fsPath}; doc fr children: ${JSON.stringify(
          Object.values(e.doc.nodes)
            .filter((n) => n.type === "frame")
            .map((n) => [n.id, (n as { children: string[] }).children]),
        )}`,
      );
    }),

    vscode.commands.registerCommand("cursorDesign.installSkill", async () => {
      const w = await installSkillFallback(pluginDir);
      vscode.window.showInformationMessage(w.length ? `Installed: ${w.join(", ")}` : "Skill already up to date in ~/.cursor");
    }),

    vscode.commands.registerCommand("cursorDesign.showStatus", () => {
      output.show(true);
      log(
        `status: mcp=${mcp.url ?? "down"} preview=${preview.url ?? "down"} cursorApi=${hasCursorApi()} open=${
          store.all().map((e) => e.uri.fsPath).join(", ") || "none"
        }`,
      );
    }),

    vscode.commands.registerCommand("cursorDesign.openPreview", () => preview.openInBrowser()),
  ];
}
