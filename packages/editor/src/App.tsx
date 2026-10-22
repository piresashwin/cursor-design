import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { indexParents, type Doc, type HostToWebview, type Op } from "@cursor-design/core";
import { createBridge } from "./bridge";
import { Board } from "./board/Board";
import { Play } from "./board/Play";
import { PagesTree } from "./panels/PagesTree";
import { TokensPanel } from "./panels/TokensPanel";
import { Properties } from "./panels/Properties";
import { screenshotNode } from "./screenshot";
import { inspectNode } from "./inspect";

export function App() {
  const bridge = useMemo(() => createBridge(), []);
  const [doc, setDoc] = useState<Doc | null>(null);
  const [path, setPath] = useState("");
  const [activePage, setActivePage] = useState<string>("");
  const [selection, setSelection] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [leftOpen, setLeftOpen] = useState(true);
  const [leftTab, setLeftTab] = useState<"pages" | "tokens">("pages");
  const [rightOpen, setRightOpen] = useState(true);
  const [playing, setPlaying] = useState(false);
  const docRef = useRef<Doc | null>(null);
  docRef.current = doc;

  const selectPage = useCallback((id: string) => {
    setActivePage(id);
    setSelection([]);
  }, []);

  useEffect(() => {
    const off = bridge.onMessage((m: HostToWebview) => {
      switch (m.type) {
        case "init":
          setDoc(m.doc);
          setPath(m.path);
          setActivePage((p) => (p && m.doc.pages[p] ? p : Object.keys(m.doc.pages)[0] ?? ""));
          setError(null);
          break;
        case "doc":
          setDoc(m.doc);
          setActivePage((p) => (p && m.doc.pages[p] ? p : Object.keys(m.doc.pages)[0] ?? ""));
          setSelection((s) => s.filter((id) => m.doc.nodes[id]));
          setError(null);
          break;
        case "select": {
          const d = docRef.current;
          if (d) {
            // switch to the page that holds the first selected node
            const idx = indexParents(d);
            let root = m.ids[0];
            while (root && idx.nodeParent[root]) root = idx.nodeParent[root];
            const pg = root ? idx.framePage[root] : undefined;
            if (pg) setActivePage(pg);
          }
          setSelection(m.ids);
          break;
        }
        case "screenshot":
        case "inspect":
          // page must be active for the node to be rendered — try to switch first
          {
            const d = docRef.current;
            if (d) {
              const idx = indexParents(d);
              let root = m.nodeId;
              while (root && idx.nodeParent[root]) root = idx.nodeParent[root];
              const pg = root ? idx.framePage[root] : undefined;
              if (pg) setActivePage(pg);
            }
            const kind = m.type;
            // wait two frames for React to commit the page switch
            requestAnimationFrame(() =>
              requestAnimationFrame(() => {
                if (kind === "screenshot") {
                  screenshotNode(m.nodeId, m.scale)
                    .then((r) => bridge.send({ type: "screenshot-result", requestId: m.requestId, ...r }))
                    .catch((e) => bridge.send({ type: "screenshot-result", requestId: m.requestId, error: String(e?.message ?? e) }));
                } else {
                  const docNow = docRef.current;
                  if (!docNow) {
                    bridge.send({ type: "inspect-result", requestId: m.requestId, error: "no document" });
                    return;
                  }
                  try {
                    const report = inspectNode(docNow, m.nodeId, m.depth ?? 4);
                    bridge.send({ type: "inspect-result", requestId: m.requestId, report });
                  } catch (e) {
                    bridge.send({ type: "inspect-result", requestId: m.requestId, error: String((e as Error)?.message ?? e) });
                  }
                }
              }),
            );
          }
          break;
        case "error":
          setError(m.message);
          break;
        case "debug-layout": {
          const info: Record<string, unknown> = { ua: navigator.userAgent, viewport: [innerWidth, innerHeight], nodes: {} };
          document.querySelectorAll<HTMLElement>("[data-node-id]").forEach((el) => {
            const cs = getComputedStyle(el);
            (info.nodes as Record<string, unknown>)[el.dataset.nodeId!] = {
              size: [el.offsetWidth, el.offsetHeight],
              display: cs.display, flexDirection: cs.flexDirection, flexGrow: cs.flexGrow, flexBasis: cs.flexBasis,
              height: cs.height, minHeight: cs.minHeight, alignSelf: cs.alignSelf, gap: cs.gap, padding: cs.padding, inline: el.getAttribute("style"),
            };
          });
          bridge.send({ type: "debug-layout-result", info });
          break;
        }
      }
    });
    bridge.send({ type: "ready" });
    return off;
  }, [bridge]);

  useEffect(() => {
    if (!docRef.current) return;
    const d = docRef.current;
    const ix = indexParents(d);
    const ids = selection.filter((id) => {
      let root = id;
      while (root && ix.nodeParent[root]) root = ix.nodeParent[root];
      return ix.framePage[root] === activePage;
    });
    bridge.send({ type: "selection", ids });
  }, [bridge, selection, activePage]);

  // expose page switching for the standalone host / CLI render
  useEffect(() => {
    if (window.__editor) (window.__editor as unknown as { selectPage: (id: string) => void }).selectPage = selectPage;
  }, [selectPage]);

  const apply = useCallback((ops: Op[]) => bridge.send({ type: "ops", ops }), [bridge]);
  const sendToCursor = useCallback((text: string) => bridge.send({ type: "send-to-cursor", text }), [bridge]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selection.length) {
        apply([{ op: "delete", ids: selection }]);
        setSelection([]);
      }
      if (e.key === "Escape") setSelection([]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection, apply]);

  if (!doc) {
    return (
      <div className="loading">
        {error ? <pre className="error">{error}</pre> : "Loading design…"}
      </div>
    );
  }

  const page = doc.pages[activePage];
  // Selection is only meaningful on the active page: drop ids whose root frame lives elsewhere.
  const idx = indexParents(doc);
  const onActivePage = (id: string) => {
    let root = id;
    while (root && idx.nodeParent[root]) root = idx.nodeParent[root];
    return idx.framePage[root] === activePage;
  };
  const pageSelection = selection.filter(onActivePage);

  const playStartId = (() => {
    const first = pageSelection[0];
    if (first) {
      let root = first;
      while (root && idx.nodeParent[root]) root = idx.nodeParent[root];
      if (root && doc.nodes[root]?.type === "frame") return root;
    }
    return page?.frames[0] ?? Object.keys(doc.nodes).find((id) => doc.nodes[id]?.type === "frame") ?? "";
  })();

  if (playing && playStartId) {
    return <Play doc={doc} startFrameId={playStartId} onExit={() => setPlaying(false)} />;
  }

  return (
    <div className="editor">
      <header className="toolbar">
        <button className={`tool ${leftOpen ? "active" : ""}`} title="Toggle left panel" onClick={() => setLeftOpen((v) => !v)}>
          ☰
        </button>
        {leftOpen && (
          <div className="seg" role="tablist">
            <button className={leftTab === "pages" ? "active" : ""} onClick={() => setLeftTab("pages")}>Pages</button>
            <button className={leftTab === "tokens" ? "active" : ""} onClick={() => setLeftTab("tokens")}>Tokens</button>
          </div>
        )}
        <span className="brand">Draft</span>
        <span className="file">
          {path.split(/[\\/]/).pop()} <span className="crumb">/ {page?.name ?? "—"}</span>
        </span>
        <span className="spacer" />
        {error && <span className="toolbar-error" title={error}>⚠ {error.slice(0, 80)}</span>}
        <span className="spacer" />
        <button
          className="btn"
          title="Play prototype links from the selected (or first) frame"
          disabled={!playStartId}
          onClick={() => setPlaying(true)}
        >
          Play
        </button>
        <button
          className="btn"
          title="Prefill Cursor chat with the current selection"
          onClick={() =>
            sendToCursor(
              selection.length
                ? `In the open design file, edit ${selection.map((id) => `${id} (${doc.nodes[id]?.name ?? doc.nodes[id]?.type})`).join(", ")}: `
                : `In the open design file (page "${page?.name}"), `,
            )
          }
        >
          Send to Cursor
        </button>
        <button className={`tool ${rightOpen ? "active" : ""}`} title="Properties" onClick={() => setRightOpen((v) => !v)}>
          ◫
        </button>
      </header>
      <div className={`workspace ${leftOpen ? "left" : ""} ${rightOpen ? "right" : ""}`}>
        {leftOpen && leftTab === "pages" && <PagesTree doc={doc} activePage={activePage} selection={pageSelection} onSelectPage={selectPage} onSelect={setSelection} apply={apply} />}
        {leftOpen && leftTab === "tokens" && <TokensPanel doc={doc} apply={apply} onSelect={setSelection} />}
        <Board doc={doc} pageId={activePage} selection={pageSelection} onSelect={setSelection} apply={apply} />
        {rightOpen && <Properties doc={doc} selection={pageSelection} apply={apply} onSend={sendToCursor} />}
      </div>
    </div>
  );
}
