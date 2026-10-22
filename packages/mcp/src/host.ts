import type { Doc, Op, ApplyResult, Annotation, InspectReport } from "@cursor-design/core";

export type DocInfo = { path: string; name: string; open: boolean; active: boolean };

/**
 * What the MCP tools need from their host.
 * The extension implements this with the live DocumentStore (+ webview for screenshot/select/inspect);
 * the CLI implements it against files on disk (no screenshot/select/inspect).
 */
export interface DesignHost {
  listDocuments(): Promise<DocInfo[]>;
  /** Resolve `file` (path or basename) or the active/sole document. */
  getDocument(file?: string): Promise<{ path: string; doc: Doc }>;
  applyOps(file: string | undefined, ops: Op[]): Promise<ApplyResult & { path: string }>;
  screenshot?(file: string | undefined, nodeId: string, scale: number): Promise<{ png: string; width: number; height: number }>;
  /** Measure rendered bounds / overlaps / clipping / styles for a node (requires open editor). */
  inspect?(file: string | undefined, nodeId: string, depth?: number): Promise<InspectReport>;
  select?(file: string | undefined, ids: string[]): Promise<void>;
  getSelection?(file: string | undefined): Promise<{ path: string; ids: string[] }>;
  /** Markdown guide (same text as SKILL.md). */
  guide(): string;
  /** Optional diagnostics sink (tool calls are logged here). */
  log?(message: string): void;
}

export type SelectionInfo = { ids: string[]; annotations: Record<string, Annotation> };
