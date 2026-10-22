import http from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DesignHost } from "./host";
import { createDesignServer } from "./tools";

export type HttpMcpOptions = {
  port?: number;
  /** Stable bearer token (prefer persisting across extension reloads). */
  token?: string;
  host?: string;
  path?: string;
  onLog?: (msg: string) => void;
};
export type HttpMcpHandle = { url: string; token: string; port: number; close(): Promise<void> };

/** True when something already answers /health on this port (e.g. prior EDH instance). */
export async function mcpHealthOk(port: number, host = "127.0.0.1"): Promise<boolean> {
  try {
    const res = await fetch(`http://${host}:${port}/health`, { signal: AbortSignal.timeout(400) });
    return res.ok;
  } catch {
    return false;
  }
}

/** True when bearer/query token is accepted by an already-running MCP on this port. */
async function mcpTokenAccepted(port: number, token: string, mcpPath: string, host: string): Promise<boolean> {
  try {
    const res = await fetch(`http://${host}:${port}${mcpPath}`, {
      method: "POST",
      signal: AbortSignal.timeout(800),
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json, text/event-stream",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "cursor-design-adopt", version: "0" } },
      }),
    });
    return res.ok && !!res.headers.get("mcp-session-id");
  } catch {
    return false;
  }
}

type Session = {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
};

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

function sessionHeader(req: http.IncomingMessage): string | undefined {
  const raw = req.headers["mcp-session-id"];
  return typeof raw === "string" && raw.length ? raw : undefined;
}

/**
 * Streamable-HTTP MCP on 127.0.0.1.
 *
 * Stateful sessions are required: Cursor opens GET /mcp as a long-lived SSE stream
 * tied to `Mcp-Session-Id` from initialize. Per-request transports (old stateless
 * mode) orphan that stream and make agent tool calls hang until timeout.
 *
 * `enableJsonResponse` keeps tools/call as plain JSON so we don't depend on SSE
 * for the response body.
 */
export async function startHttpMcp(hostImpl: DesignHost, opts: HttpMcpOptions = {}): Promise<HttpMcpHandle> {
  const token = opts.token ?? randomBytes(24).toString("base64url");
  const bind = opts.host ?? "127.0.0.1";
  const path = opts.path ?? "/mcp";
  const log = opts.onLog ?? (() => {});
  const sessions = new Map<string, Session>();

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${bind}`);
      const auth = req.headers.authorization ?? "";
      const queryToken = url.searchParams.get("token");
      const authed = auth === `Bearer ${token}` || queryToken === token;

      if (url.pathname === "/health") {
        log(`${req.method} ${url.pathname}`);
        res.writeHead(200, { "content-type": "application/json" }).end(
          JSON.stringify({ ok: true, sessions: sessions.size }),
        );
        return;
      }

      log(
        `${req.method} ${url.pathname} auth=${auth ? "header" : queryToken ? "query" : "none"}${authed ? "" : " (rejected)"} accept=${req.headers.accept ?? "-"} session=${sessionHeader(req) ?? "-"}`,
      );

      if (url.pathname !== path && url.pathname !== "/" && url.pathname !== `${path}/`) {
        res.writeHead(404, { "content-type": "application/json" }).end(JSON.stringify({ error: "not found", mcp: path }));
        return;
      }
      if (!authed) {
        res.writeHead(401, { "content-type": "application/json" }).end(
          JSON.stringify({ error: "unauthorized", hint: "Bearer token from the Cursor Design extension" }),
        );
        return;
      }

      const sid = sessionHeader(req);

      if (req.method === "DELETE") {
        if (!sid || !sessions.has(sid)) {
          res.writeHead(404, { "content-type": "application/json" }).end(JSON.stringify({ error: "unknown session" }));
          return;
        }
        const s = sessions.get(sid)!;
        sessions.delete(sid);
        await s.transport.handleRequest(req, res);
        return;
      }

      if (req.method === "GET") {
        if (!sid || !sessions.has(sid)) {
          // Cursor may probe SSE before session exists; 405/404 both confuse it —
          // return empty SSE so the client reconnects after initialize.
          res.writeHead(200, {
            "content-type": "text/event-stream",
            "cache-control": "no-cache",
            connection: "keep-alive",
          });
          res.write(": waiting-for-session\n\n");
          res.end();
          return;
        }
        await sessions.get(sid)!.transport.handleRequest(req, res);
        return;
      }

      if (req.method !== "POST") {
        res.writeHead(405, { "content-type": "application/json" }).end(JSON.stringify({ error: "method not allowed" }));
        return;
      }

      const body = (await readBody(req)) as { method?: string; params?: { name?: string; arguments?: unknown } } | undefined;
      if (body?.method === "tools/call") log(`tool ${body.params?.name} ${JSON.stringify(body.params?.arguments ?? {}).slice(0, 300)}`);
      else if (body?.method && body.method !== "notifications/initialized") log(`rpc ${body.method}`);

      const isInit = body?.method === "initialize";

      if (sid && sessions.has(sid) && !isInit) {
        await sessions.get(sid)!.transport.handleRequest(req, res, body);
        return;
      }

      // New session (initialize) or client omitted session id
      const mcp = createDesignServer(hostImpl);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableJsonResponse: true,
        onsessioninitialized: (id) => {
          sessions.set(id, { transport, server: mcp });
          log(`session ${id} initialized (${sessions.size} open)`);
        },
        onsessionclosed: (id) => {
          sessions.delete(id);
          log(`session ${id} closed`);
        },
      });
      transport.onclose = () => {
        const id = transport.sessionId;
        if (id) sessions.delete(id);
        mcp.close().catch(() => {});
      };
      await mcp.connect(transport);
      await transport.handleRequest(req, res, body);

      // If initialize didn't fire onsessioninitialized (edge), still track by transport.sessionId
      const id = transport.sessionId;
      if (id && !sessions.has(id)) sessions.set(id, { transport, server: mcp });
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
      // Prefer adopting the live server over an ephemeral port — Cursor's lease
      // stays pointed at mcpPort; a random port leaves Agent timed out forever.
      if (await mcpHealthOk(opts.port, bind) && (await mcpTokenAccepted(opts.port, token, path, bind))) {
        log(`port ${opts.port} already serving with our token — adopting (no second listener)`);
        server.close();
        return {
          url: `http://${bind}:${opts.port}${path}`,
          token,
          port: opts.port,
          close: async () => {
            /* owned by the other listener */
          },
        };
      }
      log(`port ${opts.port} busy (no adoptable /health+token), falling back to ephemeral`);
      port = await listen(0);
    } else throw e;
  }
  const url = `http://${bind}:${port}${path}`;
  // Keep half-open sockets around longer than Cursor's ~10m idle-suspend so
  // resume does not race a server-side keep-alive kill.
  server.keepAliveTimeout = 15 * 60 * 1000;
  server.headersTimeout = 16 * 60 * 1000;
  log(`MCP listening at ${url}`);
  return {
    url,
    token,
    port,
    close: () =>
      new Promise((r) => {
        for (const s of sessions.values()) {
          s.transport.close().catch(() => {});
          s.server.close().catch(() => {});
        }
        sessions.clear();
        server.close(() => r());
      }),
  };
}
