import { useState } from "react";
import { useDoc } from "../board/useDoc";
import type { Folder } from "../board/doc";

/**
 * Pages tree — folders → pages → frames (Figma model).
 * Selecting a page switches the board; selecting a frame selects it on the active page.
 * Drag a page onto a folder, or a frame onto a page. Organization only — no geometry changes.
 */
export function PagesTree() {
  const { doc, activePageId, selection, selectPage, select, movePage, moveFrame, addFolder, addPage } =
    useDoc();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState<null | { kind: "folder" } | { kind: "page"; folder: string }>(null);
  const [newName, setNewName] = useState("");
  const [drop, setDrop] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const isOpen = (id: string) => open[id] !== false;
  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !isOpen(id) }));

  function commitAdd() {
    const name = newName.trim();
    if (!adding) return;
    if (adding.kind === "folder") {
      addFolder(name || "New folder");
      setToast(`Folder “${name || "New folder"}” created`);
    } else {
      addPage(adding.folder, name || "New page");
      setToast(`Page “${name || "New page"}” created · now active`);
    }
    setNewName("");
    setAdding(null);
  }

  function onDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    const pageId = e.dataTransfer.getData("text/page-id");
    const frameId = e.dataTransfer.getData("text/frame-id");
    if (pageId && targetId.startsWith("fd_")) {
      movePage(pageId, targetId);
      setToast(`Moved page “${doc.pages[pageId].name}”`);
      setOpen((o) => ({ ...o, [targetId]: true }));
    } else if (frameId && targetId.startsWith("pg_")) {
      moveFrame(frameId, targetId);
      setToast(`Moved frame “${doc.frames[frameId].name}” → ${doc.pages[targetId].name}`);
      setOpen((o) => ({ ...o, [targetId]: true }));
    }
    setDrop(null);
  }

  function renderPage(pageId: string, depth: number) {
    const page = doc.pages[pageId];
    if (!page) return null;
    const active = pageId === activePageId;
    const expanded = isOpen(pageId);
    return (
      <div key={pageId} className="ptree__page">
        <div
          className={`ptree__row ptree__row--page ${active ? "is-active" : ""} ${drop === pageId ? "ptree__row--drop" : ""}`}
          style={{ ["--d" as string]: depth }}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("text/page-id", pageId);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes("text/frame-id")) {
              e.preventDefault();
              setDrop(pageId);
            }
          }}
          onDragLeave={() => setDrop((t) => (t === pageId ? null : t))}
          onDrop={(e) => onDrop(e, pageId)}
          onClick={() => selectPage(pageId)}
          role="button"
          tabIndex={0}
          aria-current={active ? "page" : undefined}
        >
          <button
            type="button"
            className="ptree__chev"
            onClick={(e) => {
              e.stopPropagation();
              toggle(pageId);
            }}
            aria-label={expanded ? "Collapse page" : "Expand page"}
          >
            {expanded ? "▾" : "▸"}
          </button>
          <span className="ptree__ico ptree__ico--page" aria-hidden />
          <span className="ptree__name">{page.name}</span>
          <span className="ptree__count">{page.frames.length}</span>
        </div>
        {expanded && (
          <div className="ptree__children">
            {page.frames.map((frId) => {
              const fr = doc.frames[frId];
              const sel = selection?.kind === "frame" && selection.id === frId && active;
              return (
                <div
                  key={frId}
                  className={`ptree__row ptree__row--frame ${sel ? "is-selected" : ""}`}
                  style={{ ["--d" as string]: depth + 1 }}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/frame-id", frId);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onClick={() => {
                    if (!active) selectPage(pageId);
                    select({ kind: "frame", id: frId });
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <span className="ptree__ico ptree__ico--frame" aria-hidden>
                    #
                  </span>
                  <span className="ptree__name">{fr.name}</span>
                  <span className="ptree__dim">
                    {fr.w}×{fr.h}
                  </span>
                </div>
              );
            })}
            {page.frames.length === 0 && (
              <div className="ptree__empty" style={{ ["--d" as string]: depth + 1 }}>
                No frames — ask Cursor to build one
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  function renderFolder(folder: Folder, depth: number) {
    const expanded = isOpen(folder.id);
    const pageCount = folder.children.filter((c) => c.startsWith("pg_")).length;
    return (
      <div key={folder.id} className="ptree__folder">
        <div
          className={`ptree__row ptree__row--folder ${drop === folder.id ? "ptree__row--drop" : ""}`}
          style={{ ["--d" as string]: depth }}
          onClick={() => toggle(folder.id)}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes("text/page-id")) {
              e.preventDefault();
              setDrop(folder.id);
            }
          }}
          onDragLeave={() => setDrop((t) => (t === folder.id ? null : t))}
          onDrop={(e) => onDrop(e, folder.id)}
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
        >
          <span className="ptree__chev">{expanded ? "▾" : "▸"}</span>
          <span className="ptree__ico ptree__ico--folder" aria-hidden />
          <span className="ptree__name">{folder.name}</span>
          <button
            type="button"
            className="ptree__mini"
            title="New page in this folder"
            onClick={(e) => {
              e.stopPropagation();
              setAdding({ kind: "page", folder: folder.id });
            }}
          >
            +
          </button>
          <span className="ptree__count">{pageCount}</span>
        </div>
        {expanded && (
          <div className="ptree__children">
            {folder.children.map((c) =>
              c.startsWith("pg_") ? renderPage(c, depth + 1) : renderFolder(doc.folders[c], depth + 1),
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="ptree">
      <div className="panel__head ptree__head">
        <span>Pages</span>
        <button type="button" className="ptree__add" title="New folder" onClick={() => setAdding({ kind: "folder" })}>
          + Folder
        </button>
      </div>

      <div className="ptree__tree">{doc.folderRoot.map((id) => renderFolder(doc.folders[id], 0))}</div>

      {adding && (
        <div className="ptree__new">
          <input
            autoFocus
            placeholder={adding.kind === "folder" ? "Folder name" : `Page in ${doc.folders[adding.folder].name}`}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitAdd();
              if (e.key === "Escape") setAdding(null);
            }}
          />
          <button type="button" className="btn btn--primary btn--sm" onClick={commitAdd}>
            Add
          </button>
          <button type="button" className="btn btn--quiet btn--sm" onClick={() => setAdding(null)}>
            Cancel
          </button>
        </div>
      )}

      <p className="ptree__hint">
        Folders → pages → frames. Board shows one page at a time. Drag pages onto folders, frames onto pages.
      </p>

      {toast && (
        <div className="ptree__toast" role="status">
          {toast}
          <button type="button" onClick={() => setToast(null)}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
