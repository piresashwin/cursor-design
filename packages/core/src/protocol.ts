import type { Doc } from "./types";
import type { Op as SchemaOp } from "./schema";
import type { InspectReport } from "./inspect";

/** Messages between the extension host and the editor webview. */
export type HostToWebview =
  | { type: "init"; doc: Doc; path: string; version: number }
  | { type: "doc"; doc: Doc; version: number; changed?: string[] }
  | { type: "select"; ids: string[] }
  | { type: "screenshot"; requestId: string; nodeId: string; scale: number }
  | { type: "inspect"; requestId: string; nodeId: string; depth?: number }
  | { type: "debug-layout" }
  | { type: "error"; message: string };

export type WebviewToHost =
  | { type: "ready" }
  | { type: "ops"; ops: SchemaOp[] }
  | { type: "selection"; ids: string[] }
  | { type: "screenshot-result"; requestId: string; png?: string; width?: number; height?: number; error?: string }
  | { type: "inspect-result"; requestId: string; report?: InspectReport; error?: string }
  | { type: "send-to-cursor"; text: string }
  | { type: "debug-layout-result"; info: Record<string, unknown> }
  | { type: "log"; message: string };
