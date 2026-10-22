import fs from "node:fs/promises";
import path from "node:path";
import { applyOps, parse, serialize, type Doc, type Op } from "@cursor-design/core";
import type { DesignHost, DocInfo } from "./host";

async function findDesignFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  const skip = new Set(["node_modules", ".git", "dist", "out", ".next", "build"]);
  async function walk(dir: string, depth: number) {
    if (depth > 6) return;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (!skip.has(e.name) && !e.name.startsWith(".")) await walk(path.join(dir, e.name), depth + 1);
      } else if (e.name.endsWith(".design.json")) out.push(path.join(dir, e.name));
    }
  }
  await walk(root, 0);
  return out;
}

/** Disk-backed host: used by the CLI (`design mcp`) and by tests. No screenshot/select. */
export function createFileHost(root: string, guide: string): DesignHost {
  const resolveFile = async (file?: string) => {
    const files = await findDesignFiles(root);
    if (file) {
      const abs = path.isAbsolute(file) ? file : path.join(root, file);
      const hit = files.find((f) => f === abs || path.basename(f) === file || f.endsWith(file));
      if (!hit) throw new Error(`design file not found: ${file}`);
      return hit;
    }
    if (files.length === 1) return files[0];
    if (files.length === 0) throw new Error("NO_DESIGN_FILE: no *.design.json in workspace");
    throw new Error(`AMBIGUOUS: pass file=<one of ${files.map((f) => path.relative(root, f)).join(", ")}>`);
  };
  const load = async (p: string): Promise<Doc> => {
    const r = parse(await fs.readFile(p, "utf8"));
    if (!r.ok) throw new Error(`invalid design file ${p}: ${r.error}`);
    return r.doc;
  };
  return {
    async listDocuments(): Promise<DocInfo[]> {
      const files = await findDesignFiles(root);
      const out: DocInfo[] = [];
      for (const f of files) {
        let name = path.basename(f);
        try {
          name = (await load(f)).name;
        } catch {
          /* keep basename */
        }
        out.push({ path: path.relative(root, f), name, open: false, active: false });
      }
      return out;
    },
    async getDocument(file) {
      const p = await resolveFile(file);
      return { path: path.relative(root, p), doc: await load(p) };
    },
    async applyOps(file, ops: Op[]) {
      const p = await resolveFile(file);
      const doc = await load(p);
      const r = applyOps(doc, ops);
      if (!r.errors) await fs.writeFile(p, serialize(r.doc), "utf8");
      return { ...r, path: path.relative(root, p) };
    },
    guide: () => guide,
  };
}
