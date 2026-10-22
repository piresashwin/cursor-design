import * as vscode from "vscode";
import fs from "node:fs";
import path from "node:path";
import type { Doc } from "@cursor-design/core";
import { startPreviewServer, type PreviewServerHandle } from "../previewServer";
import type { DocumentStore } from "../store";

function pickPreviewFrame(doc: Doc, selection: string[]): string | undefined {
  for (const id of selection) {
    if (doc.nodes[id]?.type === "frame") return id;
  }
  for (const page of Object.values(doc.pages)) {
    const id = page.frames[0];
    if (id && doc.nodes[id]?.type === "frame") return id;
  }
  return undefined;
}

/**
 * Localhost prototype preview: one server per extension host, SSE-pushed from DocumentStore.
 */
export class PreviewService implements vscode.Disposable {
  private server: PreviewServerHandle | undefined;
  private storeSub: vscode.Disposable | undefined;

  constructor(
    private readonly extensionPath: string,
    private readonly store: DocumentStore,
    private readonly log: (m: string) => void,
  ) {}

  get url(): string | undefined {
    return this.server?.url;
  }

  async openInBrowser(): Promise<void> {
    const e = this.store.active();
    if (!e) {
      vscode.window.showWarningMessage("Open a design file first.");
      return;
    }
    const mediaDir = path.join(this.extensionPath, "media");
    if (!fs.existsSync(path.join(mediaDir, "preview.js"))) {
      vscode.window.showErrorMessage("Preview assets missing — rebuild the extension (editor preview.js).");
      return;
    }
    const snap = {
      doc: e.doc,
      frameId: pickPreviewFrame(e.doc, e.selection),
      path: e.uri.fsPath,
    };
    if (!this.server) {
      this.server = await startPreviewServer(mediaDir, snap, { onLog: this.log });
      this.storeSub = this.store.onDidChange((d) => {
        if (!this.server) return;
        const active = this.store.active() ?? d;
        this.server.push({
          doc: active.doc,
          frameId: pickPreviewFrame(active.doc, active.selection),
          path: active.uri.fsPath,
        });
      });
    } else {
      this.server.push(snap);
    }
    await vscode.env.openExternal(vscode.Uri.parse(this.server.url));
    this.log(`opened preview ${this.server.url} for ${e.uri.fsPath}`);
  }

  dispose(): void {
    this.storeSub?.dispose();
    this.storeSub = undefined;
    void this.server?.close().catch(() => {});
    this.server = undefined;
  }
}
