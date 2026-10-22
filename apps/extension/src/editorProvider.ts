import * as vscode from "vscode";
import type { HostToWebview } from "@cursor-design/core";
import { DesignDocument, DocumentStore } from "./store";
import { editorHtml } from "./html";
import { WebviewBridge } from "./adapters/WebviewBridge";

export const VIEW_TYPE = "cursorDesign.editor";

/**
 * CustomEditorProvider with our own document model (see store.ts for why not CustomTextEditorProvider).
 * VS Code/Cursor handle dirty state, undo/redo, save, hot-exit backups through the callbacks below.
 * Webview RPC lives in WebviewBridge (S: editor lifecycle vs request bridge).
 */
export class DesignEditorProvider implements vscode.CustomEditorProvider<DesignDocument> {
  readonly onDidChangeCustomDocument: vscode.Event<vscode.CustomDocumentEditEvent<DesignDocument>>;
  private readonly bridge: WebviewBridge;

  constructor(private readonly context: vscode.ExtensionContext, private readonly store: DocumentStore, log: (m: string) => void) {
    this.onDidChangeCustomDocument = store.onDidEdit;
    this.bridge = new WebviewBridge(store, log);
  }

  static register(context: vscode.ExtensionContext, store: DocumentStore, log: (m: string) => void) {
    const provider = new DesignEditorProvider(context, store, log);
    const disposable = vscode.window.registerCustomEditorProvider(VIEW_TYPE, provider, {
      webviewOptions: { retainContextWhenHidden: true },
      supportsMultipleEditorsPerDocument: true,
    });
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
      this.bridge.attach(document, panel, (message) => {
        panel.webview.postMessage({ type: "error", message } satisfies HostToWebview);
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

  screenshot(uri: vscode.Uri, nodeId: string, scale: number) {
    return this.bridge.screenshot(uri, nodeId, scale);
  }

  inspect(uri: vscode.Uri, nodeId: string, depth = 4) {
    return this.bridge.inspect(uri, nodeId, depth);
  }

  debugLayout(uri: vscode.Uri) {
    this.bridge.debugLayout(uri);
  }

  select(uri: vscode.Uri, ids: string[]) {
    this.bridge.select(uri, ids);
  }
}
