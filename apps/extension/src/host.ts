import * as vscode from "vscode";
import path from "node:path";
import { applyOps, parse, serialize, type Op } from "@cursor-design/core";
import type { DesignHost, DocInfo } from "@cursor-design/mcp";
import { DocumentStore } from "./store";
import { DesignEditorProvider, VIEW_TYPE } from "./editorProvider";

/** DesignHost backed by the live DocumentStore (open files) with a disk fallback for closed files. */
export class ExtensionHost implements DesignHost {
  constructor(private readonly store: DocumentStore, private readonly provider: DesignEditorProvider, private readonly guideText: () => string, private readonly log_: (m: string) => void) {}

  private rel(uri: vscode.Uri) {
    return vscode.workspace.asRelativePath(uri, false);
  }

  private async findFiles(): Promise<vscode.Uri[]> {
    return vscode.workspace.findFiles("**/*.design.json", "**/{node_modules,dist,out,.git}/**", 200);
  }

  private async resolveUri(file?: string): Promise<vscode.Uri> {
    const open = this.store.all();
    if (file) {
      const norm = file.replace(/\\/g, "/");
      const hit = open.find((e) => e.uri.fsPath === file || this.rel(e.uri) === norm || e.uri.fsPath.endsWith(norm) || path.basename(e.uri.fsPath) === norm);
      if (hit) return hit.uri;
      const files = await this.findFiles();
      const f = files.find((u) => u.fsPath === file || this.rel(u) === norm || u.fsPath.endsWith(norm) || path.basename(u.fsPath) === norm);
      if (f) return f;
      throw new Error(`design file not found: ${file}`);
    }
    const active = this.store.active();
    if (active) return active.uri;
    const files = await this.findFiles();
    if (files.length === 1) return files[0];
    if (files.length === 0) throw new Error("NO_DESIGN_FILE: no *.design.json in the workspace. Ask the user to run 'Cursor Design: New design file'.");
    throw new Error(`AMBIGUOUS: several design files; pass file=<path>: ${files.map((u) => this.rel(u)).join(", ")}`);
  }

  async listDocuments(): Promise<DocInfo[]> {
    const files = await this.findFiles();
    const active = this.store.active();
    const out: DocInfo[] = [];
    for (const u of files) {
      const e = this.store.get(u);
      let name = path.basename(u.fsPath);
      if (e) name = e.doc.name;
      else {
        try {
          const r = parse(Buffer.from(await vscode.workspace.fs.readFile(u)).toString("utf8"));
          if (r.ok) name = r.doc.name;
        } catch {
          /* ignore */
        }
      }
      out.push({ path: this.rel(u), name, open: !!e, active: !!active && active.uri.toString() === u.toString() });
    }
    // open untitled/outside-workspace docs
    for (const e of this.store.all()) if (!files.some((u) => u.toString() === e.uri.toString())) out.push({ path: e.uri.fsPath, name: e.doc.name, open: true, active: active?.uri.toString() === e.uri.toString() });
    return out;
  }

  async getDocument(file?: string) {
    const uri = await this.resolveUri(file);
    const e = this.store.get(uri);
    if (e) return { path: this.rel(uri), doc: e.doc };
    const r = parse(Buffer.from(await vscode.workspace.fs.readFile(uri)).toString("utf8"));
    if (!r.ok) throw new Error(`invalid design file: ${r.error}`);
    return { path: this.rel(uri), doc: r.doc };
  }

  async applyOps(file: string | undefined, ops: Op[]) {
    const uri = await this.resolveUri(file);
    const e = this.store.get(uri);
    if (e) {
      const r = await this.store.applyOps(uri, ops, "mcp");
      if (!r.errors?.length && vscode.workspace.getConfiguration("cursorDesign").get<boolean>("autoSaveAgentEdits") !== false) {
        await vscode.workspace.save(uri).then(undefined, (err) => this.log_(`auto-save failed: ${(err as Error).message}`));
      }
      return { ...r, path: this.rel(uri) };
    }
    // closed file: edit on disk (the custom editor will pick it up if opened later)
    const text = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString("utf8");
    const p = parse(text);
    if (!p.ok) throw new Error(`invalid design file: ${p.error}`);
    const r = applyOps(p.doc, ops);
    if (!r.errors) {
      await vscode.workspace.fs.writeFile(uri, Buffer.from(serialize(r.doc), "utf8"));
      this.log_(`mcp applied ${ops.length} op(s) to closed file ${this.rel(uri)}`);
    }
    return { ...r, path: this.rel(uri) };
  }

  async screenshot(file: string | undefined, nodeId: string, scale: number) {
    const uri = await this.resolveUri(file);
    if (!this.store.get(uri)) {
      // auto-open in the custom editor, then capture
      await vscode.commands.executeCommand("vscode.openWith", uri, VIEW_TYPE, { preview: false, preserveFocus: true });
      await new Promise((r) => setTimeout(r, 800));
    }
    return this.provider.screenshot(uri, nodeId, scale);
  }

  async inspect(file: string | undefined, nodeId: string, depth?: number) {
    const uri = await this.resolveUri(file);
    if (!this.store.get(uri)) {
      await vscode.commands.executeCommand("vscode.openWith", uri, VIEW_TYPE, { preview: false, preserveFocus: true });
      await new Promise((r) => setTimeout(r, 800));
    }
    return this.provider.inspect(uri, nodeId, depth ?? 4);
  }

  async select(file: string | undefined, ids: string[]) {
    const uri = await this.resolveUri(file);
    if (!this.store.get(uri)) await vscode.commands.executeCommand("vscode.openWith", uri, VIEW_TYPE, { preview: false, preserveFocus: true });
    await new Promise((r) => setTimeout(r, 300));
    this.provider.select(uri, ids);
  }

  async getSelection(file?: string) {
    const uri = await this.resolveUri(file);
    const e = this.store.get(uri);
    return { path: this.rel(uri), ids: e?.selection ?? [] };
  }

  guide() {
    return this.guideText();
  }

  log(message: string) {
    this.log_(message);
  }
}
