import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Doc } from "@cursor-design/core";
import { PrototypeShell } from "./board/PrototypeShell";
import { ensureDocFonts } from "./fonts";
import "./styles.css";

function firstFrameId(doc: Doc): string | undefined {
  for (const page of Object.values(doc.pages)) {
    const id = page.frames[0];
    if (id && doc.nodes[id]?.type === "frame") return id;
  }
  return undefined;
}

function PreviewApp() {
  const [doc, setDoc] = useState<Doc | null>(null);
  const [frameId, setFrameId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);

  const applyDoc = (next: Doc, preferred?: string) => {
    setDoc(next);
    ensureDocFonts(next);
    setFrameId((cur) => {
      const want = preferred && next.nodes[preferred]?.type === "frame" ? preferred : cur;
      if (want && next.nodes[want]?.type === "frame") return want;
      return firstFrameId(next);
    });
  };

  useEffect(() => {
    let closed = false;
    const boot = async () => {
      try {
        const res = await fetch("/api/doc");
        if (!res.ok) throw new Error(`doc ${res.status}`);
        const body = (await res.json()) as { doc: Doc; frameId?: string };
        if (closed) return;
        applyDoc(body.doc, body.frameId);
        setError(null);
      } catch (e) {
        if (!closed) setError(String((e as Error).message ?? e));
      }
    };
    void boot();

    const es = new EventSource("/events");
    es.onopen = () => setLive(true);
    es.onerror = () => setLive(false);
    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as { type?: string; doc?: Doc; frameId?: string };
        if (msg.type === "doc" && msg.doc) applyDoc(msg.doc, msg.frameId);
      } catch {
        /* ignore malformed */
      }
    };
    return () => {
      closed = true;
      es.close();
    };
  }, []);

  const start = useMemo(() => frameId, [frameId]);

  if (error) {
    return (
      <div className="play">
        <div className="play__bar">
          <span className="play__title">Preview</span>
          <span className="play__crumb">{error}</span>
        </div>
      </div>
    );
  }
  if (!doc || !start) {
    return (
      <div className="play">
        <div className="play__bar">
          <span className="play__title">Preview</span>
          <span className="play__crumb">Waiting for document…</span>
        </div>
      </div>
    );
  }

  return (
    <PrototypeShell
      doc={doc}
      startFrameId={start}
      trailing={<span className="play__badge">{live ? "Live" : "Reconnecting…"}</span>}
    />
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PreviewApp />
  </StrictMode>,
);
