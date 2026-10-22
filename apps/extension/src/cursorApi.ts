import * as vscode from "vscode";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

export const MCP_SERVER_NAME = "cursor-design";

type CursorNs = typeof vscode.cursor | undefined;

function cursorNs(): CursorNs {
  return (vscode as unknown as { cursor?: typeof vscode.cursor }).cursor;
}

export function hasCursorApi(): boolean {
  return typeof cursorNs()?.mcp?.registerServer === "function";
}

/** Register our local streamable-HTTP MCP server with Cursor. Returns false when running outside Cursor. */
export function registerMcp(url: string, token: string): boolean {
  const c = cursorNs();
  if (!c?.mcp?.registerServer) return false;
  try {
    c.mcp.unregisterServer?.(MCP_SERVER_NAME);
  } catch {
    /* not registered yet */
  }
  c.mcp.registerServer({ name: MCP_SERVER_NAME, server: { url, headers: { Authorization: `Bearer ${token}` } } });
  return true;
}

export function unregisterMcp() {
  try {
    cursorNs()?.mcp?.unregisterServer?.(MCP_SERVER_NAME);
  } catch {
    /* ignore */
  }
}

export function registerPluginPath(p: string): boolean {
  const c = cursorNs();
  if (!c?.plugins?.registerPath) return false;
  c.plugins.registerPath(p);
  return true;
}

export function unregisterPluginPath(p: string) {
  try {
    cursorNs()?.plugins?.unregisterPath?.(p);
  } catch {
    /* ignore */
  }
}

export function mcpJsonEntry(url: string, token: string) {
  return { [MCP_SERVER_NAME]: { url, headers: { Authorization: `Bearer ${token}` } } };
}

/** Fallback for environments without the extension API: merge our entry into <workspace>/.cursor/mcp.json. */
export async function writeWorkspaceMcpJson(url: string, token: string): Promise<vscode.Uri | undefined> {
  const root = vscode.workspace.workspaceFolders?.[0];
  if (!root) return undefined;
  const dir = vscode.Uri.joinPath(root.uri, ".cursor");
  const file = vscode.Uri.joinPath(dir, "mcp.json");
  let json: { mcpServers?: Record<string, unknown> } = {};
  try {
    json = JSON.parse(Buffer.from(await vscode.workspace.fs.readFile(file)).toString("utf8"));
  } catch {
    /* new file */
  }
  json.mcpServers = { ...(json.mcpServers ?? {}), ...mcpJsonEntry(url, token) };
  await vscode.workspace.fs.createDirectory(dir);
  await vscode.workspace.fs.writeFile(file, Buffer.from(JSON.stringify(json, null, 2) + "\n", "utf8"));
  return file;
}

/** Prefill Cursor's chat with a prompt (user still presses send). */
export async function sendToCursor(text: string) {
  const uri = vscode.Uri.parse(`cursor://anysphere.cursor-deeplink/prompt?text=${encodeURIComponent(text)}`);
  await vscode.env.openExternal(uri);
}


/**
 * Fallback when `vscode.cursor.plugins.registerPath` is unavailable (observed on Cursor 3.x):
 * copy the bundled skill (+ references) and rule into ~/.cursor/skills and ~/.cursor/rules.
 */
export async function installSkillFallback(pluginDir: string): Promise<string[]> {
  const home = os.homedir();
  const skillSrc = path.join(pluginDir, "skills", "cursor-design");
  const skillDst = path.join(home, ".cursor", "skills", "cursor-design");
  const targets: [string, string][] = [
    [path.join(skillSrc, "SKILL.md"), path.join(skillDst, "SKILL.md")],
    [path.join(pluginDir, "rules", "cursor-design.mdc"), path.join(home, ".cursor", "rules", "cursor-design.mdc")],
  ];
  try {
    const refs = await fs.readdir(path.join(skillSrc, "references"));
    for (const f of refs) {
      if (f.endsWith(".md")) {
        targets.push([path.join(skillSrc, "references", f), path.join(skillDst, "references", f)]);
      }
    }
  } catch {
    /* no references dir */
  }
  const written: string[] = [];
  for (const [src, dst] of targets) {
    const body = await fs.readFile(src, "utf8");
    let existing: string | undefined;
    try {
      existing = await fs.readFile(dst, "utf8");
    } catch {
      /* new */
    }
    if (existing === body) continue;
    await fs.mkdir(path.dirname(dst), { recursive: true });
    await fs.writeFile(dst, body, "utf8");
    written.push(dst);
  }
  return written;
}
