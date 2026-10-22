import { useEffect, useMemo, useRef, useState } from "react";
import { indexParents, nodeDisplayLabel, type Doc, type FrameNode, type Node, type Op } from "@cursor-design/core";

type Props = {
  doc: Doc;
  activePage: string;
  selection: string[];
  onSelectPage: (id: string) => void;
  onSelect: (ids: string[]) => void;
  apply: (ops: Op[]) => void;
};
type Kind = "frame" | "page" | "folder";
type Zone = "before" | "after" | "into";
type Dragged = { kind: Kind; id: string };
type Drop = { id: string; zone: Zone };

const TYPE_ICO: Record<string, string> = {
  frame: "#",
  text: "T",
  rect: "▭",
  ellipse: "○",
  image: "▣",
  icon: "◇",
  chart: "▦",
  shape: "⬠",
  avatar: "◉",
  progress: "◐",
  skeleton: "▭",
  instance: "⧉",
};

function nodeLabel(n: Node | undefined, id: string): string {
  return nodeDisplayLabel(n, id);
}

/** Frames with children start collapsed; pages/folders start open. */
function defaultCollapsed(doc: Doc, id: string): boolean {
  const n = doc.nodes[id];
  return n?.type === "frame" && (n as FrameNode).children.length > 0;
}

export function PagesTree({ doc, activePage, selection, onSelectPage, onSelect, apply }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [drop, setDrop] = useState<Drop | null>(null);
  const dragged = useRef<Dragged | null>(null);
  const parents = useMemo(() => indexParents(doc), [doc]);
  const toggle = (id: string) =>
    setCollapsed((c) => {
      const currently = id in c ? c[id] : defaultCollapsed(doc, id);
      return { ...c, [id]: !currently };
    });
  const isCollapsed = (id: string) => (id in collapsed ? collapsed[id] : defaultCollapsed(doc, id));

  // Keep the path to the current selection expanded in the tree.
  useEffect(() => {
    const id = selection[0];
    if (!id) return;
    const expand: string[] = [];
    let cur: string | undefined = id;
    while (cur) {
      expand.push(cur);
      cur = parents.nodeParent[cur];
    }
    let root = id;
    while (parents.nodeParent[root]) root = parents.nodeParent[root];
    const page = parents.framePage[root] ?? parents.framePage[id];
    if (page) expand.push(page);
    setCollapsed((c) => {
      const next = { ...c };
      for (const k of expand) next[k] = false;
      return next;
    });
  }, [selection, parents]);

  const folderParentOf = (id: string) => Object.keys(doc.folders).find((fid) => doc.folders[fid].children.includes(id)) ?? null;
  const pageOfFrame = (id: string) => Object.keys(doc.pages).find((pid) => doc.pages[pid].frames.includes(id));

  const planOp = (d: Dragged, targetKind: Kind | "root", targetId: string, zone: Zone): Op | null => {
    const adjust = (list: string[], insert: number) => {
      const cur = list.indexOf(d.id);
      return cur >= 0 && cur < insert ? insert - 1 : insert;
    };
    if (targetKind === "root") {
      if (d.kind === "page") return { op: "movePage", id: d.id, folder: null };
      if (d.kind === "folder") return { op: "moveFolder", id: d.id, parent: null };
      return null;
    }
    if (d.kind === "frame") {
      if (targetKind === "page") return { op: "moveFrame", id: d.id, page: targetId };
      if (targetKind === "frame") {
        const page = pageOfFrame(targetId);
        if (!page) return null;
        const list = doc.pages[page].frames;
        const insert = adjust(list, list.indexOf(targetId) + (zone === "after" ? 1 : 0));
        return { op: "moveFrame", id: d.id, page, index: insert };
      }
      return null;
    }
    if (d.kind === "page") {
      if (targetKind === "folder" && zone === "into") return { op: "movePage", id: d.id, folder: targetId };
      const parent = folderParentOf(targetId);
      if (!parent) return { op: "movePage", id: d.id, folder: null };
      const list = doc.folders[parent].children;
      const insert = adjust(list, list.indexOf(targetId) + (zone === "after" ? 1 : 0));
      return { op: "movePage", id: d.id, folder: parent, index: insert };
    }
    if (targetKind === "folder" && zone === "into") return { op: "moveFolder", id: d.id, parent: targetId };
    const parent = folderParentOf(targetId);
    const list = parent ? doc.folders[parent].children : doc.folderRoot;
    const insert = adjust(list, list.indexOf(targetId) + (zone === "after" ? 1 : 0));
    return { op: "moveFolder", id: d.id, parent, index: insert };
  };

  const zoneFrom = (e: React.DragEvent, acceptInto: boolean): Zone => {
    const r = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientY - r.top) / r.height;
    if (acceptInto && rel > 0.3 && rel < 0.7) return "into";
    return rel < 0.5 ? "before" : "after";
  };

  const onRowDragStart = (kind: Kind, id: string) => (e: React.DragEvent) => {
    dragged.current = { kind, id };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };
  const onRowDragOver = (targetKind: Kind | "root", targetId: string) => (e: React.DragEvent) => {
    const d = dragged.current;
    if (!d || d.id === targetId) return;
    const zone = targetKind === "root" ? "into" : zoneFrom(e, targetKind === "folder" || (targetKind === "page" && d.kind === "frame"));
    const op = planOp(d, targetKind, targetId, zone);
    if (!op) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDrop({ id: targetId, zone });
  };
  const onRowDrop = (targetKind: Kind | "root", targetId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const d = dragged.current;
    dragged.current = null;
    setDrop(null);
    if (!d || d.id === targetId) return;
    const zone = targetKind === "root" ? "into" : zoneFrom(e, targetKind === "folder" || (targetKind === "page" && d.kind === "frame"));
    const op = planOp(d, targetKind, targetId, zone);
    if (op) apply([op]);
  };
  const dropClass = (id: string) => (drop?.id === id ? ` drop-${drop.zone}` : "");

  const selectNode = (pageId: string, nodeId: string) => {
    if (pageId !== activePage) onSelectPage(pageId);
    onSelect([nodeId]);
  };

  const renderNode = (id: string, pageId: string, depth: number) => {
    const n = doc.nodes[id];
    if (!n) return null;
    const kids = n.type === "frame" ? (n as FrameNode).children : [];
    const hasKids = kids.length > 0;
    const selected = selection.includes(id) && pageId === activePage;
    const dim =
      typeof n.width === "number" && typeof n.height === "number"
        ? `${n.width}×${n.height}`
        : "";

    return (
      <div key={id}>
        <div
          className={`row node node-${n.type}${selected ? " selected" : ""}${dropClass(id)}`}
          style={{ paddingLeft: 8 + depth * 12 }}
          onClick={() => selectNode(pageId, id)}
          title={hasKids ? "Click to select · chevron to expand children" : "Click to select · edit in Properties"}
          {...(n.type === "frame" && pageOfFrame(id)
            ? {
                draggable: true,
                onDragStart: onRowDragStart("frame", id),
                onDragOver: onRowDragOver("frame", id),
                onDrop: onRowDrop("frame", id),
                onDragEnd: () => setDrop(null),
              }
            : {})}
        >
          {hasKids ? (
            <button
              className="chev"
              onClick={(e) => {
                e.stopPropagation();
                toggle(id);
              }}
            >
              {isCollapsed(id) ? "▸" : "▾"}
            </button>
          ) : (
            <span className="chev spacer" />
          )}
          <span className="ico">{TYPE_ICO[n.type] ?? "·"}</span>
          <span className="name">{nodeLabel(n, id)}</span>
          {dim && <span className="dim">{dim}</span>}
        </div>
        {hasKids && !isCollapsed(id) && kids.map((c) => renderNode(c, pageId, depth + 1))}
      </div>
    );
  };

  const renderPage = (id: string, depth: number) => {
    const p = doc.pages[id];
    if (!p) return null;
    return (
      <div key={id}>
        <div
          className={`row page ${id === activePage ? "active" : ""}${dropClass(id)}`}
          style={{ paddingLeft: 8 + depth * 12 }}
          onClick={() => onSelectPage(id)}
          draggable
          onDragStart={onRowDragStart("page", id)}
          onDragOver={onRowDragOver("page", id)}
          onDrop={onRowDrop("page", id)}
          onDragEnd={() => setDrop(null)}
          title="Double-click to rename · drag to reorder"
          onDoubleClick={(e) => {
            e.stopPropagation();
            const name = prompt("Rename page", p.name);
            if (name && name !== p.name) apply([{ op: "renamePage", id, name }]);
          }}
        >
          <button
            className="chev"
            onClick={(e) => {
              e.stopPropagation();
              toggle(id);
            }}
          >
            {isCollapsed(id) ? "▸" : "▾"}
          </button>
          <span className="ico">▢</span>
          <span className="name">{p.name}</span>
          <span className="count">{p.frames.length}</span>
        </div>
        {!isCollapsed(id) && p.frames.map((f) => renderNode(f, id, depth + 1))}
      </div>
    );
  };

  const renderFolder = (id: string, depth: number) => {
    const f = doc.folders[id];
    if (!f) return null;
    return (
      <div key={id}>
        <div
          className={`row folder${dropClass(id)}`}
          style={{ paddingLeft: 8 + depth * 12 }}
          onClick={() => toggle(id)}
          draggable
          onDragStart={onRowDragStart("folder", id)}
          onDragOver={onRowDragOver("folder", id)}
          onDrop={onRowDrop("folder", id)}
          onDragEnd={() => setDrop(null)}
          title="Double-click to rename · drag to reorder or nest"
          onDoubleClick={(e) => {
            e.stopPropagation();
            const name = prompt("Rename folder", f.name);
            if (name && name !== f.name) apply([{ op: "renameFolder", id, name }]);
          }}
        >
          <span className="chev">{isCollapsed(id) ? "▸" : "▾"}</span>
          <span className="ico">▣</span>
          <span className="name">{f.name}</span>
          <button
            className="mini"
            title="New page"
            onClick={(e) => {
              e.stopPropagation();
              const name = prompt("Page name", "New page");
              if (name) apply([{ op: "createPage", name, folder: id }]);
            }}
          >
            +
          </button>
        </div>
        {!isCollapsed(id) && f.children.map((c) => (doc.pages[c] ? renderPage(c, depth + 1) : renderFolder(c, depth + 1)))}
      </div>
    );
  };

  const rootPages = Object.keys(doc.pages).filter((p) => !Object.values(doc.folders).some((f) => f.children.includes(p)));

  return (
    <aside className="panel left">
      <div className="panel-head" onDragOver={onRowDragOver("root", "root")} onDrop={onRowDrop("root", "root")}>
        <span>Pages</span>
        <button
          className="mini"
          title="New folder"
          onClick={() => {
            const name = prompt("Folder name", "New folder");
            if (name) apply([{ op: "createFolder", name, parent: null }]);
          }}
        >
          + Folder
        </button>
      </div>
      <div className="tree">
        {doc.folderRoot.map((id) => renderFolder(id, 0))}
        {rootPages.map((id) => renderPage(id, 0))}
      </div>
      <p className="hint">folders → pages → frames → nodes · click a node to edit Properties</p>
    </aside>
  );
}
