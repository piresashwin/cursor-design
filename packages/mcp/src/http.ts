import http from "node:http";
import { randomBytes } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { DesignHost } from "./host";
import { createDesignServer } from "./tools";

export type HttpMcpOptions = { port?: number; token?: string; host?: string; path?: string; onLog?: (msg: string) => void };
export type HttpMcpHandle = { url: string; token: string; port: number; close(): Promise<void> };

function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve(undefined);
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

/**
 * Streamable-HTTP MCP endpoint bound to 127.0.0.1, bearer-token protected, stateless
 * (a fresh McpServer per request — cheap, and avoids session bookkeeping).
 */
export async function startHttpMcp(hostImpl: DesignHost, opts: HttpMcpOptions = {}): Promise<HttpMcpHandle> {
  const token = opts.token ?? randomBytes(24).toString("base64url");
  const bind = opts.host ?? "127.0.0.1";
  const path = opts.path ?? "/mcp";
  const log = opts.onLog ?? (() => {});

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${bind}`);
      const auth = req.headers.authorization ?? "";
      const queryToken = url.searchParams.get("token");
      const authed = auth === `Bearer ${token}` || queryToken === token;
      log(`${req.method} ${url.pathname} auth=${auth ? "header" : queryToken ? "query" : "none"}${authed ? "" : " (rejected)"} accept=${req.headers.accept ?? "-"}`);
      if (url.pathname === "/health") {
        res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ ok: true }));
        return;
      }
      if (url.pathname !== path && url.pathname !== "/" && url.pathname !== `${path}/`) {
        res.writeHead(404, { "content-type": "application/json" }).end(JSON.stringify({ error: "not found", mcp: path }));
        return;
      }
      if (!authed) {
        res.writeHead(401, { "content-type": "application/json" }).end(JSON.stringify({ error: "unauthorized", hint: "Bearer token from the Cursor Design extension" }));
        return;
      }
      if (req.method === "GET" || req.method === "DELETE") {
        // stateless: no server-initiated streams / sessions
        res.writeHead(405, { "content-type": "application/json" }).end(JSON.stringify({ error: "stateless server: POST only" }));
        return;
      }
      const body = (await readBody(req)) as { method?: string; params?: { name?: string; arguments?: unknown } } | undefined;
      if (body?.method === "tools/call") log(`tool ${body.params?.name} ${JSON.stringify(body.params?.arguments ?? {}).slice(0, 300)}`);
      else if (body?.method && body.method !== "notifications/initialized") log(`rpc ${body.method}`);
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      const mcp = createDesignServer(hostImpl);
      res.on("close", () => {
        transport.close().catch(() => {});
        mcp.close().catch(() => {});
      });
      await mcp.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (e) {
      log(`mcp http error: ${(e as Error).message}`);
      if (!res.headersSent) res.writeHead(500, { "content-type": "application/json" }).end(JSON.stringify({ error: String(e) }));
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
      log(`port ${opts.port} busy, falling back to ephemeral`);
      port = await listen(0);
    } else throw e;
  }
  const url = `http://${bind}:${port}${path}`;
  log(`MCP listening at ${url}`);
  return { url, token, port, close: () => new Promise((r) => server.close(() => r())) };
}
