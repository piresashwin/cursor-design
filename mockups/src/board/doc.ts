/**
 * Mock document model — mirrors PLAN.md §3.2:
 * folderRoot → folders[id].children (folder ids + page ids) → pages[id].frames → frames.
 * Single-direction references only; parents are derived.
 */

export type FrameKind =
  | "landing"
  | "pricing"
  | "login"
  | "signup"
  | "email"
  | "welcome"
  | "empty";

export type ArtboardSize = "phone" | "desktop" | "wide" | "square";

export type Frame = {
  id: string;
  name: string;
  kind: FrameKind;
  size: ArtboardSize;
  w: number;
  h: number;
  /** Prototype link target (frame id), may cross pages */
  link?: string;
};

export type Page = { id: string; name: string; frames: string[] };
export type Folder = { id: string; name: string; children: string[] };

export type Doc = {
  folderRoot: string[];
  folders: Record<string, Folder>;
  pages: Record<string, Page>;
  frames: Record<string, Frame>;
};

export const seedDoc: Doc = {
  folderRoot: ["fd_app", "fd_marketing"],
  folders: {
    fd_app: { name: "Pulse app", id: "fd_app", children: ["pg_sprint", "pg_auth", "fd_onboarding"] },
    fd_onboarding: { name: "Onboarding", id: "fd_onboarding", children: ["pg_welcome"] },
    fd_marketing: { name: "Marketing", id: "fd_marketing", children: ["pg_email"] },
  },
  pages: {
    pg_sprint: { id: "pg_sprint", name: "Sprint 12", frames: ["fr_landing", "fr_login", "fr_winback"] },
    pg_auth: { id: "pg_auth", name: "Auth", frames: ["fr_login2", "fr_signup"] },
    pg_welcome: { id: "pg_welcome", name: "Welcome", frames: ["fr_welcome1", "fr_welcome2"] },
    pg_email: { id: "pg_email", name: "Email", frames: ["fr_winback2"] },
  },
  frames: {
    fr_landing: { id: "fr_landing", name: "Landing", kind: "landing", size: "desktop", w: 1280, h: 800, link: "fr_login" },
    fr_login: { id: "fr_login", name: "Login", kind: "login", size: "phone", w: 390, h: 844, link: "fr_welcome1" },
    fr_winback: { id: "fr_winback", name: "Email · winback", kind: "email", size: "wide", w: 1440, h: 900 },
    fr_login2: { id: "fr_login2", name: "Login", kind: "login", size: "phone", w: 390, h: 844, link: "fr_signup" },
    fr_signup: { id: "fr_signup", name: "Sign up", kind: "signup", size: "phone", w: 390, h: 844 },
    fr_welcome1: { id: "fr_welcome1", name: "Welcome 1", kind: "welcome", size: "phone", w: 390, h: 844, link: "fr_welcome2" },
    fr_welcome2: { id: "fr_welcome2", name: "Welcome 2", kind: "welcome", size: "phone", w: 390, h: 844 },
    fr_winback2: { id: "fr_winback2", name: "Winback v2", kind: "email", size: "wide", w: 1440, h: 900 },
  },
};

/** Derived parent index (never stored in the doc). */
export function indexParents(doc: Doc) {
  const pageFolder: Record<string, string> = {};
  const folderParent: Record<string, string> = {};
  const framePage: Record<string, string> = {};
  for (const f of Object.values(doc.folders)) {
    for (const c of f.children) {
      if (c.startsWith("pg_")) pageFolder[c] = f.id;
      else folderParent[c] = f.id;
    }
  }
  for (const p of Object.values(doc.pages)) for (const fr of p.frames) framePage[fr] = p.id;
  return { pageFolder, folderParent, framePage };
}

export function movePage(doc: Doc, pageId: string, toFolder: string): Doc {
  const folders: Record<string, Folder> = {};
  for (const f of Object.values(doc.folders)) {
    const children = f.children.filter((c) => c !== pageId);
    folders[f.id] = { ...f, children: f.id === toFolder ? [...children, pageId] : children };
  }
  return { ...doc, folders };
}

export function moveFrame(doc: Doc, frameId: string, toPage: string): Doc {
  const pages: Record<string, Page> = {};
  for (const p of Object.values(doc.pages)) {
    const frames = p.frames.filter((f) => f !== frameId);
    pages[p.id] = { ...p, frames: p.id === toPage ? [...frames, frameId] : frames };
  }
  return { ...doc, pages };
}

export function createFolder(doc: Doc, name: string): Doc {
  const id = `fd_${Date.now().toString(36)}`;
  return {
    ...doc,
    folderRoot: [...doc.folderRoot, id],
    folders: { ...doc.folders, [id]: { id, name, children: [] } },
  };
}

export function createPage(doc: Doc, folderId: string, name: string): { doc: Doc; id: string } {
  const id = `pg_${Date.now().toString(36)}`;
  const folder = doc.folders[folderId];
  return {
    id,
    doc: {
      ...doc,
      pages: { ...doc.pages, [id]: { id, name, frames: [] } },
      folders: { ...doc.folders, [folderId]: { ...folder, children: [...folder.children, id] } },
    },
  };
}
