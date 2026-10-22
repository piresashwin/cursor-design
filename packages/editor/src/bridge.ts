import { applyOps, sampleDoc, type Doc, type HostToWebview, type WebviewToHost, type Op, type InspectReport } from "@cursor-design/core";

type Listener = (msg: HostToWebview) => void;

export interface Bridge {
  readonly mode: "vscode" | "standalone";
  send(msg: WebviewToHost): void;
  onMessage(l: Listener): () => void;
}

declare global {
  interface Window {
    acquireVsCodeApi?: () => { postMessage(m: unknown): void; getState(): unknown; setState(s: unknown): void };
    __DESIGN_DOC__?: Doc;
    __editor?: {
      getDoc(): Doc;
      applyOps(ops: Op[]): ReturnType<typeof applyOps>;
      screenshot(nodeId: string, scale?: number): Promise<{ png: string; width: number; height: number }>;
      inspect(nodeId: string, depth?: number): Promise<InspectReport>;
      select(ids: string[]): void;
      lastSendToCursor?: string;
    };
  }
}

/** In VS Code: postMessage bridge. Standalone (browser / Playwright): an in-page fake host. */
export function createBridge(): Bridge {
  const listeners = new Set<Listener>();
  const emit = (m: HostToWebview) => listeners.forEach((l) => l(m));

  if (window.acquireVsCodeApi) {
    const api = window.acquireVsCodeApi();
    window.addEventListener("message", (e) => emit(e.data as HostToWebview));
    return {
      mode: "vscode",
      send: (m) => api.postMessage(m),
      onMessage: (l) => {
        listeners.add(l);
        return () => listeners.delete(l);
      },
    };
  }

  // ---- standalone fake host
  let doc: Doc = window.__DESIGN_DOC__ ?? sampleDoc();
  let version = 1;
  const bridge: Bridge = {
    mode: "standalone",
    send: (m) => {
      if (m.type === "ready") setTimeout(() => emit({ type: "init", doc, path: "standalone.design.json", version }), 0);
      if (m.type === "ops") {
        const r = applyOps(doc, m.ops);
        if (r.errors) emit({ type: "error", message: r.errors.map((e) => e.message).join("; ") });
        else {
          doc = r.doc;
          version++;
          emit({ type: "doc", doc, version, changed: r.changed });
        }
      }
      if (m.type === "screenshot-result") shotPending.get(m.requestId)?.(m);
      if (m.type === "inspect-result") inspectPending.get(m.requestId)?.(m);
      if (m.type === "send-to-cursor" && window.__editor) window.__editor.lastSendToCursor = m.text;
      if (m.type === "log") console.log("[editor]", m.message);
    },
    onMessage: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
  const shotPending = new Map<string, (m: WebviewToHost & { type: "screenshot-result" }) => void>();
  const inspectPending = new Map<string, (m: WebviewToHost & { type: "inspect-result" }) => void>();
  window.__editor = {
    getDoc: () => doc,
    applyOps: (ops) => {
      bridge.send({ type: "ops", ops });
      return { doc, inverse: [], changed: [] };
    },
    screenshot: (nodeId, scale = 1) =>
      new Promise((resolve, reject) => {
        const requestId = Math.random().toString(36).slice(2);
        shotPending.set(requestId, (m) => {
          shotPending.delete(requestId);
          if (m.error || !m.png) reject(new Error(m.error ?? "no png"));
          else resolve({ png: m.png, width: m.width ?? 0, height: m.height ?? 0 });
        });
        emit({ type: "screenshot", requestId, nodeId, scale });
      }),
    inspect: (nodeId, depth = 4) =>
      new Promise((resolve, reject) => {
        const requestId = Math.random().toString(36).slice(2);
        inspectPending.set(requestId, (m) => {
          inspectPending.delete(requestId);
          if (m.error || !m.report) reject(new Error(m.error ?? "no report"));
          else resolve(m.report);
        });
        emit({ type: "inspect", requestId, nodeId, depth });
      }),
    select: (ids) => emit({ type: "select", ids }),
  };
  return bridge;
}
