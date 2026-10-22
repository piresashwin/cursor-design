import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import type { Doc } from "@cursor-design/core";

export type PreviewSnapshot = { doc: Doc; frameId?: string; path?: string };

export type PreviewServerHandle = {
  url: string;
  port: number;
  push(snap: PreviewSnapshot): void;
  close(): Promise<void>;
};

type SseClient = { res: http.ServerResponse; id: number };

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".map": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

function previewHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self'; script-src 'self'" />
<link rel="stylesheet" href="/editor.css" />
<title>Cursor Design Preview</title>
</head>
<body>
<div id="root"></div>
<script type="module" src="/preview.js"></script>
</body>
</html>`;
}

/**
 * Localhost-only HTTP + SSE preview host. Serves the built prototype shell and
 * pushes `{ type:"doc", doc }` whenever the open design document changes.
 */
export async function startPreviewServer(
  mediaDir: string,
  initial: PreviewSnapshot,
  opts: { port?: number; onLog?: (m: string) => void } = {},
): Promise<PreviewServerHandle> {
  const bind = "127.0.0.1";
  const log = opts.onLog ?? (() => {});
  let snap = initial;
  let nextClientId = 1;
  const clients = new Map<number, SseClient>();

  const broadcast = () => {
    const payload = `data: ${JSON.stringify({ type: "doc", doc: snap.doc, frameId: snap.frameId })}\n\n`;
    for (const c of clients.values()) {
      try {
        c.res.write(payload);
      } catch {
        clients.delete(c.id);
      }
    }
  };

  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${bind}`);
      if (url.pathname === "/api/doc") {
        res.writeHead(200, {
          "content-type": "application/json",
          "cache-control": "no-store",
        });
        res.end(JSON.stringify({ doc: snap.doc, frameId: snap.frameId, path: snap.path }));
        return;
      }
      if (url.pathname === "/events") {
        res.writeHead(200, {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          connection: "keep-alive",
        });
        res.write(": ok\n\n");
        const id = nextClientId++;
        clients.set(id, { res, id });
        // Immediate snapshot so late joiners don't wait for the next edit
        res.write(`data: ${JSON.stringify({ type: "doc", doc: snap.doc, frameId: snap.frameId })}\n\n`);
        req.on("close", () => clients.delete(id));
        return;
      }
      if (url.pathname === "/" || url.pathname === "/index.html") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
        res.end(previewHtml());
        return;
      }
      // Static assets from editor/preview build (media/)
      const rel = path.normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, "").replace(/^(\.\.[/\\])+/, "");
      const file = path.resolve(mediaDir, rel);
      const root = path.resolve(mediaDir);
      if (!file.startsWith(root + path.sep) && file !== root) {
        res.writeHead(404).end("not found");
        return;
      }
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404).end("not found");
        return;
      }
      const ext = path.extname(file);
      res.writeHead(200, { "content-type": MIME[ext] ?? "application/octet-stream" });
      fs.createReadStream(file).pipe(res);
    } catch (e) {
      log(`preview http error: ${(e as Error).message}`);
      if (!res.headersSent) res.writeHead(500).end(String(e));
    }
  });

  const listen = (port: number) =>
    new Promise<number>((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, bind, () => {
        server.off("error", reject);
        const addr = server.address();
        resolve(typeof addr === "object" && addr ? addr.port : port);
      });
    });

  let port: number;
  try {
    port = await listen(opts.port ?? 0);
  } catch (e) {
    if (opts.port && (e as NodeJS.ErrnoException).code === "EADDRINUSE") {
      log(`preview port ${opts.port} busy, falling back to ephemeral`);
      port = await listen(0);
    } else throw e;
  }

  const url = `http://${bind}:${port}/`;
  log(`preview listening at ${url}`);
  return {
    url,
    port,
    push(next) {
      snap = next;
      broadcast();
    },
    close: () =>
      new Promise((r) => {
        for (const c of clients.values()) c.res.end();
        clients.clear();
        server.close(() => r());
      }),
  };
}
