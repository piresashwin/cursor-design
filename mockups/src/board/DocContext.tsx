import { useMemo, useState, type ReactNode } from "react";
import { DocCtx, type DocState, type Selection } from "./useDoc";
import {
  createFolder,
  createPage,
  indexParents,
  moveFrame,
  movePage,
  seedDoc,
  type Doc,

} from "./doc";

type Props = {
  children: ReactNode;
  initialPage?: string;
  initialSelection?: Selection;
};

export type { Selection };

export function DocProvider({ children, initialPage = "pg_sprint", initialSelection = null }: Props) {
  const [doc, setDoc] = useState<Doc>(seedDoc);
  const [activePageId, setActivePageId] = useState(initialPage);
  const [selection, setSelection] = useState<Selection>(initialSelection);

  const value = useMemo<DocState>(() => {
    const parents = indexParents(doc);
    const page = doc.pages[activePageId];
    const activeFrames = page ? page.frames.map((id) => doc.frames[id]).filter(Boolean) : [];
    return {
      doc,
      activePageId,
      selection,
      parents,
      activeFrames,
      selectPage: (id) => {
        setActivePageId(id);
        setSelection(null);
      },
      select: setSelection,
      movePage: (pageId, toFolder) => setDoc((d) => movePage(d, pageId, toFolder)),
      moveFrame: (frameId, toPage) => setDoc((d) => moveFrame(d, frameId, toPage)),
      addFolder: (name) => setDoc((d) => createFolder(d, name)),
      addPage: (folderId, name) =>
        setDoc((d) => {
          const r = createPage(d, folderId, name);
          setActivePageId(r.id);
          return r.doc;
        }),
    };
  }, [doc, activePageId, selection]);

  return <DocCtx.Provider value={value}>{children}</DocCtx.Provider>;
}
