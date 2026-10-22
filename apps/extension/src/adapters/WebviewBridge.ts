import * as vscode from "vscode";
import type { HostToWebview, InspectReport, WebviewToHost } from "@cursor-design/core";
import type { DesignDocument, DocumentStore } from "../store";
import { sendToCursor } from "../cursorApi";

type PendingShot = {
  kind: "screenshot";
  resolve: (v: { png: string; width: number; height: number }) => void;
  reject: (e: Error) => void;
  timer: NodeJS.Timeout;
};
type PendingInspect = {
  kind: "inspect";
  resolve: (v: InspectReport) => void;
  reject: (e: Error) => void;
  timer: NodeJS.Timeout;
};
type Pending = PendingShot | PendingInspect;

/**
 * Request/response bridge between extension host and editor webviews
 * (screenshot, inspect, selection, ops acknowledgements).
 */
export class WebviewBridge {
  private pending = new Map<string, Pending>();

  constructor(
    private readonly store: DocumentStore,
    private readonly log: (m: string) => void,
  ) {}

  /** Wire one panel ↔ document for the lifetime of the webview. */
  attach(document: DesignDocument, panel: vscode.WebviewPanel, onOpsError: (msg: string) => void): vscode.Disposable {
    const sub = panel.webview.onDidReceiveMessage(async (m: WebviewToHost) => {
      switch (m.type) {
        case "ready":
          panel.webview.postMessage({
            type: "init",
            doc: document.doc,
            path: document.uri.fsPath,
            version: document.version,
          } satisfies HostToWebview);
          break;
        case "ops": {
          try {
            const r = await this.store.applyOps(document.uri, m.ops, "ui");
            if (r.errors?.length) onOpsError(r.errors.map((e) => e.message).join("; "));
          } catch (e) {
            onOpsError(String((e as Error).message));
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
    });
    return sub;
  }

  private pickPanel(uri: vscode.Uri): vscode.WebviewPanel | undefined {
    const entry = this.store.get(uri);
    if (!entry) return undefined;
    return [...entry.panels].find((p) => p.visible) || entry.panels.values().next().value;
  }

  screenshot(uri: vscode.Uri, nodeId: string, scale: number): Promise<{ png: string; width: number; height: number }> {
    const panel = this.pickPanel(uri);
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

  inspect(uri: vscode.Uri, nodeId: string, depth = 4): Promise<InspectReport> {
    const panel = this.pickPanel(uri);
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
