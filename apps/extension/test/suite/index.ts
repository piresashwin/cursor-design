// Runs inside the Extension Development Host. No mocha: a tiny sequential runner.
import * as vscode from "vscode";
import fs from "node:fs";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const EXT_ID = "cursor-design.cursor-design";
const BID = `bt_it_${Date.now().toString(36)}`;
const VIEW_TYPE = "cursorDesign.editor";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const assert = (c: unknown, m: string) => {
  if (!c) throw new Error("ASSERT: " + m);
};

export async function run(): Promise<void> {
  const root = vscode.workspace.workspaceFolders![0].uri;
  const file = vscode.Uri.joinPath(root, "pulse.design.json");
  const original = fs.readFileSync(file.fsPath, "utf8");
  const outDir = path.join(__dirname, "..", "..", ".test-out");
  fs.mkdirSync(outDir, { recursive: true });
  const results: string[] = [];
  const step = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
      results.push(`ok   ${name}`);
    } catch (e) {
      results.push(`FAIL ${name}: ${(e as Error).stack ?? e}`);
      throw e;
    }
  };

  try {
    const ext = vscode.extensions.getExtension(EXT_ID);
    assert(ext, `extension ${EXT_ID} not found`);
    const api = (await ext!.activate()) as { getMcp(): { url: string; token: string } | undefined; openDocuments(): string[]; hasCursorApi(): boolean };

    await step("activate + MCP up", async () => {
      assert(api.getMcp(), "mcp not started");
      const h = await fetch(api.getMcp()!.url.replace(/\/mcp$/, "/health"));
      assert(h.ok, "health endpoint");
    });

    await step("open file in custom editor (vscode.openWith)", async () => {
      await vscode.commands.executeCommand("vscode.openWith", file, VIEW_TYPE);
      await sleep(1500);
      const tab = vscode.window.tabGroups.activeTabGroup.activeTab;
      assert(tab && tab.input instanceof vscode.TabInputCustom && tab.input.viewType === VIEW_TYPE, `active tab is not the custom editor: ${tab?.label}`);
      assert(api.openDocuments().some((p) => p.endsWith("pulse.design.json")), "store has the document open");
    });

    const { url, token } = api.getMcp()!;
    const client = new Client({ name: "integration", version: "0" });
    await client.connect(new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));

    await step("design_list sees the open doc", async () => {
      const r = await client.callTool({ name: "design_list", arguments: {} });
      const text = (r.content as { text: string }[])[0].text;
      assert(/"open": true/.test(text), "doc reported open: " + text.slice(0, 200));
    });

    await step("design_apply adds a blue button (live doc → auto-saved to disk)", async () => {
      const r = await client.callTool({
        name: "design_apply",
        arguments: {
          ops: [
            { op: "create", parent: "fr_login", index: 4, node: { id: BID, type: "frame", name: "Blue button", fill: "#1D4ED8", width: "fill", height: 48, radius: "$radius.md", layout: { direction: "row", align: "center", justify: "center" }, children: [] } },
            { op: "create", parent: BID, node: { id: `${BID}_tx`, type: "text", content: "Blue", fill: "#FFFFFF", font: "$type.label", width: "hug", height: "hug" } },
          ],
        },
      });
      assert(!r.isError, "apply failed: " + JSON.stringify(r.content));
      await sleep(700);
      assert(fs.readFileSync(file.fsPath, "utf8").includes(`"${BID}"`), "file on disk updated (agent edits auto-save)");
      const tab = vscode.window.tabGroups.activeTabGroup.activeTab;
      assert(tab && !tab.isDirty, "tab is clean after auto-save");
    });

    await step("design_screenshot returns a PNG from the webview", async () => {
      const r = await client.callTool({ name: "design_screenshot", arguments: { nodeId: "fr_login", scale: 1 } });
      assert(!r.isError, "screenshot failed: " + JSON.stringify(r.content).slice(0, 300));
      const img = (r.content as { type: string; data?: string }[]).find((c) => c.type === "image");
      assert(img?.data && img.data.length > 1000, "image content present");
      const buf = Buffer.from(img!.data!, "base64");
      assert(buf.subarray(1, 4).toString() === "PNG", "PNG magic");
      fs.writeFileSync(path.join(outDir, "fr_login.integration.png"), buf);
    });

    await step("design_select + design_get_selection", async () => {
      await client.callTool({ name: "design_select", arguments: { nodeIds: [BID] } });
      await sleep(300);
      const r = await client.callTool({ name: "design_get_selection", arguments: {} });
      assert(new RegExp(BID).test((r.content as { text: string }[])[0].text), "selection reports ${BID}");
    });

    await step("undo reverts the agent batch (ops-based undo) and save persists it", async () => {
      await vscode.commands.executeCommand("vscode.openWith", file, VIEW_TYPE);
      await sleep(300);
      await vscode.commands.executeCommand("undo");
      await sleep(600);
      const r = await client.callTool({ name: "design_get", arguments: { nodeId: BID } });
      assert(r.isError, "${BID} gone from the live document after undo");
      const tab = vscode.window.tabGroups.activeTabGroup.activeTab;
      assert(tab && tab.isDirty, "tab is dirty after undo (disk still has ${BID})");
      await vscode.commands.executeCommand("workbench.action.files.save");
      await sleep(600);
      assert(!fs.readFileSync(file.fsPath, "utf8").includes(`"${BID}"`), "save wrote the undone document to disk");
    });

    await step("external edit on disk reloads a clean document", async () => {
      const text = fs.readFileSync(file.fsPath, "utf8").replace('"content": "Welcome back"', '"content": "Hello again"');
      fs.writeFileSync(file.fsPath, text, "utf8");
      await sleep(1200);
      const r = await client.callTool({ name: "design_get", arguments: { nodeId: "tx_title" } });
      assert(/Hello again/.test((r.content as { text: string }[])[0].text), "store reloaded from disk after external change");
    });

    await client.close();
  } finally {
    fs.writeFileSync(file.fsPath, original, "utf8");
    fs.writeFileSync(path.join(outDir, "integration.log"), results.join("\n") + "\n");
    console.log("\n" + results.join("\n"));
    await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor").then(undefined, () => {});
  }
}
