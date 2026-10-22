import * as vscode from "vscode";
import { applyOps, parse, serialize, type ApplyResult, type Doc, type HostToWebview, type Op } from "@cursor-design/core";

/**
 * A design document owned by the extension (CustomEditorProvider model).
 * We deliberately do NOT depend on VS Code's TextDocument mirror: Cursor 3.19 fails to resolve
 * CustomTextEditorProviders in some activation paths ("Unable to retrieve document from URI").
 */
export class DesignDocument implements vscode.CustomDocument {
  version = 1;
  panels = new Set<vscode.WebviewPanel>();
  selection: string[] = [];
  /** Serialized text as last loaded from / written to disk — dirty = serialize(doc) !== savedText. */
  savedText: string;
  private _onDidDispose = new vscode.EventEmitter<void>();
  readonly onDidDispose = this._onDidDispose.event;

  constructor(public readonly uri: vscode.Uri, public doc: Doc, text: string) {
    this.savedText = text;
  }

  get isDirty() {
    return serialize(this.doc) !== this.savedText;
  }

  dispose() {
    this._onDidDispose.fire();
    this._onDidDispose.dispose();
  }
}

export type EditEvent = vscode.CustomDocumentEditEvent<DesignDocument>;

export class DocumentStore {
  private entries = new Map<string, DesignDocument>();
  private _onDidEdit = new vscode.EventEmitter<EditEvent>();
  /** Undo/redo-able edits, consumed by the CustomEditorProvider. */
  readonly onDidEdit = this._onDidEdit.event;
  private _onDidChange = new vscode.EventEmitter<DesignDocument>();
  readonly onDidChange = this._onDidChange.event;
  activeKey: string | undefined;

  constructor(private readonly log: (m: string) => void) {}

  key(uri: vscode.Uri) {
    return uri.toString();
  }

  get(uri: vscode.Uri) {
    return this.entries.get(this.key(uri));
  }

  all(): DesignDocument[] {
    return [...this.entries.values()];
  }

  active(): DesignDocument | undefined {
    return (this.activeKey && this.entries.get(this.activeKey)) || this.entries.values().next().value;
  }

  /** Create (or reuse) the document model for a file's text. Throws a readable error for invalid docs. */
  open(uri: vscode.Uri, text: string): DesignDocument {
    const k = this.key(uri);
    const existing = this.entries.get(k);
    if (existing) return existing;
    const r = parse(text);
    if (!r.ok) throw new Error(`Not a valid design document (use "Cursor Design: Open as JSON" to fix it):\n${r.error}`);
    const d = new DesignDocument(uri, r.doc, text);
    d.onDidDispose(() => {
      this.entries.delete(k);
      if (this.activeKey === k) this.activeKey = undefined;
    });
    this.entries.set(k, d);
    return d;
  }

  /** Apply a batch (from UI or MCP). Fires an undoable edit; broadcasts to all webviews. */
  async applyOps(uri: vscode.Uri, ops: Op[], source: "ui" | "mcp"): Promise<ApplyResult> {
    const d = this.get(uri);
    if (!d) throw new Error("document not open");
    const r = applyOps(d.doc, ops);
    if (r.errors?.length) return r;
    this.set(d, r.doc, r.changed);
    const label = `${source === "mcp" ? "Agent" : "Edit"}: ${ops.length} op${ops.length === 1 ? "" : "s"}`;
    this._onDidEdit.fire({
      document: d,
      label,
      undo: () => {
        const u = applyOps(d.doc, r.inverse);
        if (u.errors?.length) this.log(`undo failed: ${JSON.stringify(u.errors)}`);
        else this.set(d, u.doc, u.changed);
      },
      redo: () => {
        const x = applyOps(d.doc, ops);
        if (x.errors?.length) this.log(`redo failed: ${JSON.stringify(x.errors)}`);
        else this.set(d, x.doc, x.changed);
      },
    });
    this.log(`${source} applied ${ops.length} op(s) → ${r.changed.length} changed`);
    return r;
  }

  private set(d: DesignDocument, doc: Doc, changed?: string[]) {
    d.doc = doc;
    d.version++;
    this.broadcast(d, { type: "doc", doc: d.doc, version: d.version, changed });
    this._onDidChange.fire(d);
  }

  async save(d: DesignDocument, target?: vscode.Uri) {
    const text = serialize(d.doc);
    await vscode.workspace.fs.writeFile(target ?? d.uri, Buffer.from(text, "utf8"));
    if (!target || target.toString() === d.uri.toString()) d.savedText = text;
  }

  async revert(d: DesignDocument) {
    const text = Buffer.from(await vscode.workspace.fs.readFile(d.uri)).toString("utf8");
    this.loadText(d, text);
  }

  /** External change on disk (git checkout, hand edit, agent file tools). Ignored while dirty. */
  async reloadIfClean(uri: vscode.Uri) {
    const d = this.get(uri);
    if (!d) return;
    const text = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString("utf8");
    if (text === d.savedText) return; // our own save echoing back
    if (d.isDirty) {
      this.log(`external change to ${uri.fsPath} ignored: document has unsaved edits`);
      this.broadcast(d, { type: "error", message: "File changed on disk; you have unsaved edits. Save to overwrite or revert to reload." });
      return;
    }
    this.loadText(d, text);
    this.log(`reloaded ${uri.fsPath} from disk`);
  }

  private loadText(d: DesignDocument, text: string) {
    const r = parse(text);
    if (!r.ok) {
      this.broadcast(d, { type: "error", message: `File on disk is not a valid design document: ${r.error}` });
      return;
    }
    d.savedText = text;
    this.set(d, r.doc);
  }

  broadcast(d: DesignDocument, msg: HostToWebview, except?: vscode.WebviewPanel) {
    for (const p of d.panels) if (p !== except) p.webview.postMessage(msg);
  }
}
