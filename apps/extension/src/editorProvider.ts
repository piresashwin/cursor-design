import * as vscode from "vscode";
import type { HostToWebview, InspectReport, WebviewToHost } from "@cursor-design/core";
import { DesignDocument, DocumentStore } from "./store";
import { editorHtml } from "./html";
import { sendToCursor } from "./cursorApi";

export const VIEW_TYPE = "cursorDesign.editor";

type PendingShot = { kind: "screenshot"; resolve: (v: { png: string; width: number; height: number }) => void; reject: (e: Error) => void; timer: NodeJS.Timeout };
type PendingInspect = { kind: "inspect"; resolve: (v: InspectReport) => void; reject: (e: Error) => void; timer: NodeJS.Timeout };
type Pending = PendingShot | PendingInspect;

/**
 * CustomEditorProvider with our own document model (see store.ts for why not CustomTextEditorProvider).
 * VS Code/Cursor handle dirty state, undo/redo, save, hot-exit backups through the callbacks below.
 */
export class DesignEditorProvider implements vscode.CustomEditorProvider<DesignDocument> {
  private pending = new Map<string, Pending>();
  readonly onDidChangeCustomDocument: vscode.Event<vscode.CustomDocumentEditEvent<DesignDocument>>;

  constructor(private readonly context: vscode.ExtensionContext, private readonly store: DocumentStore, private readonly log: (m: string) => void) {
    this.onDidChangeCustomDocument = store.onDidEdit;
  }

  static register(context: vscode.ExtensionContext, store: DocumentStore, log: (m: string) => void) {
    const provider = new DesignEditorProvider(context, store, log);
    const disposable = vscode.window.registerCustomEditorProvider(VIEW_TYPE, provider, {
      webviewOptions: { retainContextWhenHidden: true },
      supportsMultipleEditorsPerDocument: true,
    });
    // external edits (git, hand edits, agent file tools)
    const watcher = vscode.workspace.createFileSystemWatcher("**/*.design.json");
    watcher.onDidChange((uri) => store.reloadIfClean(uri).catch((e) => log(`reload failed: ${(e as Error).message}`)));
    context.subscriptions.push(watcher);
    return { provider, disposable };
  }

  async openCustomDocument(uri: vscode.Uri, ctx: vscode.CustomDocumentOpenContext): Promise<DesignDocument> {
    const source = ctx.backupId ? vscode.Uri.parse(ctx.backupId) : uri;
    const text = Buffer.from(await vscode.workspace.fs.readFile(source)).toString("utf8");
    const d = this.store.open(uri, text);
    if (ctx.backupId) d.savedText = ""; // restored from backup → dirty
    return d;
  }

  async resolveCustomEditor(document: DesignDocument, panel: vscode.WebviewPanel): Promise<void> {
    panel.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, "media")] };
    panel.webview.html = editorHtml(panel.webview, this.context.extensionUri);
    document.panels.add(panel);
    this.store.activeKey = this.store.key(document.uri);

    const subs: vscode.Disposable[] = [];
    subs.push(
      panel.onDidChangeViewState(() => {
        if (panel.active) this.store.activeKey = this.store.key(document.uri);
      }),
    );
    subs.push(
      panel.webview.onDidReceiveMessage(async (m: WebviewToHost) => {
        switch (m.type) {
          case "ready":
            panel.webview.postMessage({ type: "init", doc: document.doc, path: document.uri.fsPath, version: document.version } satisfies HostToWebview);
            break;
          case "ops": {
            try {
              const r = await this.store.applyOps(document.uri, m.ops, "ui");
              if (r.errors?.length) panel.webview.postMessage({ type: "error", message: r.errors.map((e) => e.message).join("; ") } satisfies HostToWebview);
            } catch (e) {
              panel.webview.postMessage({ type: "error", message: String((e as Error).message) } satisfies HostToWebview);
            }
            break;
          }
          case "selection":
            document.selection = m.ids;
            break;
          case "screenshot-result": {
            const p = this.pending.get(m.requestId);
            if (!p || p.kind !== "screenshot") break;
            this.pending.delete(m.requestId);
            clearTimeout(p.timer);
            if (m.error || !m.png) p.reject(new Error(m.error ?? "no image"));
            else p.resolve({ png: m.png, width: m.width ?? 0, height: m.height ?? 0 });
            break;
          }
          case "inspect-result": {
            const p = this.pending.get(m.requestId);
            if (!p || p.kind !== "inspect") break;
            this.pending.delete(m.requestId);
            clearTimeout(p.timer);
            if (m.error || !m.report) p.reject(new Error(m.error ?? "no report"));
            else p.resolve(m.report);
            break;
          }
          case "send-to-cursor":
            await sendToCursor(m.text);
            break;
          case "log":
            this.log(`[webview] ${m.message}`);
            break;
          case "debug-layout-result":
            this.log(`[layout] ${JSON.stringify(m.info, null, 2)}`);
            break;
        }
      }),
    );

    panel.onDidDispose(() => {
      subs.forEach((s) => s.dispose());
      document.panels.delete(panel);
    });
  }

  saveCustomDocument(document: DesignDocument): Thenable<void> {
    return this.store.save(document);
  }

  saveCustomDocumentAs(document: DesignDocument, destination: vscode.Uri): Thenable<void> {
    return this.store.save(document, destination);
  }

  revertCustomDocument(document: DesignDocument): Thenable<void> {
    return this.store.revert(document);
  }

  async backupCustomDocument(document: DesignDocument, ctx: vscode.CustomDocumentBackupContext): Promise<vscode.CustomDocumentBackup> {
    await this.store.save(document, ctx.destination);
    return { id: ctx.destination.toString(), delete: () => vscode.workspace.fs.delete(ctx.destination).then(undefined, () => undefined) };
  }

  /** Ask a webview showing `uri` to capture `nodeId`. */
  screenshot(uri: vscode.Uri, nodeId: string, scale: number): Promise<{ png: string; width: number; height: number }> {
    const entry = this.store.get(uri);
    const panel = entry && ([...entry.panels].find((p) => p.visible) || entry.panels.values().next().value);
    if (!panel) return Promise.reject(new Error("NO_ACTIVE_DOCUMENT: open the design file in the Cursor Design editor"));
    const requestId = Math.random().toString(36).slice(2);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error("screenshot timed out (is the editor tab visible?)"));
      }, 20000);
      this.pending.set(requestId, { kind: "screenshot", resolve, reject, timer });
      panel.reveal(undefined, true);
      panel.webview.postMessage({ type: "screenshot", requestId, nodeId, scale } satisfies HostToWebview);
    });
  }

  /** Ask a webview to measure layout for `nodeId` (bounds, overlaps, clipping, styles). */
  inspect(uri: vscode.Uri, nodeId: string, depth = 4): Promise<InspectReport> {
    const entry = this.store.get(uri);
    const panel = entry && ([...entry.panels].find((p) => p.visible) || entry.panels.values().next().value);
    if (!panel) return Promise.reject(new Error("NO_ACTIVE_DOCUMENT: open the design file in the Cursor Design editor"));
    const requestId = Math.random().toString(36).slice(2);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error("inspect timed out (is the editor tab visible?)"));
      }, 20000);
      this.pending.set(requestId, { kind: "inspect", resolve, reject, timer });
      panel.reveal(undefined, true);
      panel.webview.postMessage({ type: "inspect", requestId, nodeId, depth } satisfies HostToWebview);
    });
  }

  debugLayout(uri: vscode.Uri) {
    const entry = this.store.get(uri);
    if (!entry) throw new Error("NO_ACTIVE_DOCUMENT");
    for (const p of entry.panels) p.webview.postMessage({ type: "debug-layout" } satisfies HostToWebview);
  }

  select(uri: vscode.Uri, ids: string[]) {
    const entry = this.store.get(uri);
    if (!entry) throw new Error("NO_ACTIVE_DOCUMENT");
    entry.selection = ids;
    for (const p of entry.panels) {
      p.reveal(undefined, true);
      p.webview.postMessage({ type: "select", ids } satisfies HostToWebview);
    }
  }
}
