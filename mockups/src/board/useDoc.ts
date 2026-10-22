import { createContext, useContext } from "react";
import type { Doc, Frame } from "./doc";
import type { indexParents } from "./doc";

export type Selection =
  | { kind: "frame"; id: string }
  | { kind: "instance"; id: string; name: string; frame: string; component: string; variant: string; link?: string }
  | { kind: "text"; id: string; name: string; frame: string }
  | null;

export type DocState = {
  doc: Doc;
  activePageId: string;
  selection: Selection;
  parents: ReturnType<typeof indexParents>;
  activeFrames: Frame[];
  selectPage: (id: string) => void;
  select: (sel: Selection) => void;
  movePage: (pageId: string, toFolder: string) => void;
  moveFrame: (frameId: string, toPage: string) => void;
  addFolder: (name: string) => void;
  addPage: (folderId: string, name: string) => void;
};

export const DocCtx = createContext<DocState | null>(null);

export function useDoc() {
  const v = useContext(DocCtx);
  if (!v) throw new Error("useDoc outside DocProvider");
  return v;
}
