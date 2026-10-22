import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { sampleDoc, serialize } from "@cursor-design/core";
import { createFileHost, startHttpMcp } from "./index";

test("streamable HTTP MCP: list tools, apply ops, bearer auth", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "cd-mcp-"));
  await fs.writeFile(path.join(dir, "app.design.json"), serialize(sampleDoc()));
  const host = createFileHost(dir, "# guide");
  const h = await startHttpMcp(host, { port: 0 });
  try {
    // unauthorized
    const bad = await fetch(h.url, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    assert.equal(bad.status, 401);

    const client = new Client({ name: "test", version: "0" });
    const transport = new StreamableHTTPClientTransport(new URL(h.url), { requestInit: { headers: { Authorization: `Bearer ${h.token}` } } });
    await client.connect(transport);
    const tools = await client.listTools();
    const names = tools.tools.map((t) => t.name).sort();
    assert.deepEqual(names, [
      "design_apply",
      "design_components",
      "design_get",
      "design_get_selection",
      "design_guide",
      "design_inspect",
      "design_list",
      "design_screenshot",
      "design_select",
      "design_tokens",
    ]);

    const get = await client.callTool({ name: "design_get", arguments: {} });
    const summary = JSON.parse((get.content as { text: string }[])[0].text);
    assert.equal(summary.name, "Pulse");

    const apply = await client.callTool({
      name: "design_apply",
      arguments: { ops: [{ op: "create", parent: "fr_login", node: { type: "frame", name: "Blue button", fill: "#1D4ED8", width: "fill", height: 44, children: [] } }] },
    });
    assert.ok(!apply.isError, JSON.stringify(apply.content));
    const after = JSON.parse(await fs.readFile(path.join(dir, "app.design.json"), "utf8"));
    assert.ok(Object.values(after.nodes).some((n: unknown) => (n as { name?: string }).name === "Blue button"));

    const bogus = await client.callTool({ name: "design_apply", arguments: { ops: [{ op: "update", id: "nope", set: { fill: "#000" } }] } });
    assert.ok(bogus.isError);

    const tokens = await client.callTool({ name: "design_tokens", arguments: { action: "list", group: "color" } });
    assert.match((tokens.content as { text: string }[])[0].text, /color\.accent/);
    await client.close();
  } finally {
    await h.close();
  }
});
