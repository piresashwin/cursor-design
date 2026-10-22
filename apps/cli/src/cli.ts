import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { parse, serialize, validate, sampleDoc, withPrimitiveCatalog } from "@cursor-design/core";
import { createDesignServer, createFileHost } from "@cursor-design/mcp";

const here = path.dirname(fileURLToPath(import.meta.url));

function arg(name: string, def?: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
}

async function readGuide() {
  const candidates = [
    path.join(here, "../../extension/plugin/skills/cursor-design/SKILL.md"),
    path.join(here, "../../../apps/extension/plugin/skills/cursor-design/SKILL.md"),
  ];
  for (const c of candidates) {
    try {
      return withPrimitiveCatalog(await fs.readFile(c, "utf8"));
    } catch {
      /* next */
    }
  }
  return withPrimitiveCatalog("# Cursor Design\nSee design_get / design_apply tool descriptions.");
}

const cmd = process.argv[2];

switch (cmd) {
  case "validate": {
    const file = process.argv[3];
    const text = await fs.readFile(file, "utf8");
    const r = parse(text);
    if (!r.ok) {
      console.error(r.error);
      process.exit(1);
    }
    const errs = validate(r.doc);
    if (errs.length) {
      console.error(errs.join("\n"));
      process.exit(1);
    }
    console.log(`ok: ${file} (${Object.keys(r.doc.nodes).length} nodes, ${Object.keys(r.doc.pages).length} pages)`);
    break;
  }
  case "new": {
    const file = process.argv[3] ?? "app.design.json";
    await fs.writeFile(file, serialize(sampleDoc(path.basename(file, ".design.json"))), { flag: "wx" });
    console.log(`created ${file}`);
    break;
  }
  case "mcp": {
    // stdio MCP server against files on disk — for Cursor CLI / CI (no screenshot/select)
    const root = path.resolve(process.argv[3] ?? process.cwd());
    const server = createDesignServer(createFileHost(root, await readGuide()));
    await server.connect(new StdioServerTransport());
    break;
  }
  case "render": {
    // Headless render via Playwright (Chrome channel or a Playwright chromium) — the second screenshot path.
    const file = path.resolve(process.argv[3]);
    const frame = arg("frame");
    const out = arg("out", "frame.png")!;
    const scale = Number(arg("scale", "1"));
    const text = await fs.readFile(file, "utf8");
    const r = parse(text);
    if (!r.ok) throw new Error(r.error);
    const editorDir = arg("editor", path.join(here, "../../../packages/editor/dist"))!;
    const html = await fs.readFile(path.join(editorDir, "index.html"), "utf8");
    const { chromium } = await import("playwright-core");
    const launch = async () => {
      try {
        return await chromium.launch({ channel: "chrome" });
      } catch {
        return await chromium.launch();
      }
    };
    const browser = await launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: process.argv.includes("--native") ? scale : 1 });
      await page.addInitScript((doc) => {
        (window as unknown as { __DESIGN_DOC__: unknown }).__DESIGN_DOC__ = doc;
      }, r.doc);
      await page.route("**/*", async (route) => {
        const u = new URL(route.request().url());
        if (u.pathname === "/" || u.pathname === "/index.html") return route.fulfill({ body: html, contentType: "text/html" });
        const p = path.join(editorDir, u.pathname);
        try {
          const body = await fs.readFile(p);
          const ct = p.endsWith(".js") ? "text/javascript" : p.endsWith(".css") ? "text/css" : "application/octet-stream";
          return route.fulfill({ body, contentType: ct });
        } catch {
          return route.fulfill({ status: 404 });
        }
      });
      await page.goto("http://cursor-design.local/");
      await page.waitForSelector("[data-node-id]");
      const frameId = frame ?? Object.values(r.doc.pages)[0].frames[0];
      if (frame) await page.evaluate((id) => (window as unknown as { __editor: { select(ids: string[]): void } }).__editor.select([id]), frame);
      // make sure the frame's page is active: pick page containing frame
      const pageId = Object.entries(r.doc.pages).find(([, p]) => p.frames.includes(frameId))?.[0];
      if (pageId) await page.evaluate((pid) => (window as unknown as { __editor: { selectPage?(id: string): void } }).__editor.selectPage?.(pid), pageId);
      const el = page.locator(`[data-node-id="${frameId}"]`).first();
      await el.waitFor();
      if (process.argv.includes("--native")) {
        // Playwright element capture (affected by board zoom; kept for comparison)
        await el.screenshot({ path: out, animations: "disabled" });
      } else {
        // same html-to-image path the extension uses inside the webview → exact frame pixels, zoom-independent
        const shot = await page.evaluate(
          ([id, s]) => (window as unknown as { __editor: { screenshot(id: string, s: number): Promise<{ png: string; width: number; height: number }> } }).__editor.screenshot(id as string, s as number),
          [frameId, scale] as const,
        );
        await fs.writeFile(out, Buffer.from(shot.png, "base64"));
      }
      console.log(`wrote ${out} (${frameId})`);
    } finally {
      await browser.close();
    }
    break;
  }
  default:
    console.log(`cursor-design <command>
  new [file]                         create a starter *.design.json
  validate <file>                    schema + reference check
  mcp [root]                         stdio MCP server over design files on disk (Cursor CLI / CI)
  render <file> --frame <id> --out <png> [--scale 2] [--native]   headless PNG via Chrome/Playwright`);
}
