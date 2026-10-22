import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  ComponentDefSchema,
  OpSchema,
  TokenSchema,
  componentUsages,
  listComponents,
  tokenUsages,
  type Doc,
  type Node,
  type Op,
} from "@cursor-design/core";
import type { DesignHost } from "./host";

const text = (v: unknown) => ({ content: [{ type: "text" as const, text: typeof v === "string" ? v : JSON.stringify(v, null, 2) }] });
const errorResult = (message: string) => ({ isError: true, content: [{ type: "text" as const, text: message }] });

function summarize(doc: Doc) {
  const pages = Object.entries(doc.pages).map(([id, p]) => ({
    id,
    name: p.name,
    frames: p.frames.map((f) => {
      const n = doc.nodes[f];
      return { id: f, name: n?.name, width: n?.width, height: n?.height };
    }),
  }));
  const folders = Object.entries(doc.folders).map(([id, f]) => ({ id, name: f.name, children: f.children }));
  return {
    name: doc.name,
    tokens: Object.keys(doc.tokens),
    components: Object.keys(doc.components ?? {}),
    folderRoot: doc.folderRoot,
    folders,
    pages,
    annotationsOpen: Object.values(doc.annotations ?? {}).filter((a) => a.status === "open").length,
  };
}

function subtree(doc: Doc, id: string, depth: number): unknown {
  const n = doc.nodes[id];
  if (!n) return null;
  if (n.type !== "frame" || depth <= 0) return n;
  return { ...n, childNodes: n.children.map((c) => subtree(doc, c, depth - 1)) };
}

export function createDesignServer(host: DesignHost): McpServer {
  const server = new McpServer({ name: "cursor-design", version: "0.0.1" });

  server.registerTool(
    "design_guide",
    { title: "Design guide", description: "How to use the design tools: schema, ops, workflow. Call this first in a session." },
    async () => text(host.guide()),
  );

  server.registerTool(
    "design_list",
    { title: "List design files", description: "List *.design.json files in the workspace with their pages and top-level frames." },
    async () => {
      const docs = await host.listDocuments();
      const out = [];
      for (const d of docs) {
        try {
          const { doc } = await host.getDocument(d.path);
          out.push({ ...d, pages: summarize(doc).pages });
        } catch {
          out.push(d);
        }
      }
      return text(out);
    },
  );

  server.registerTool(
    "design_get",
    {
      title: "Get document / node",
      description: "Without nodeId: document summary (tokens, folders, pages, frames). With nodeId: that node's subtree, depth-limited. Use annotations:true to include open annotations.",
      inputSchema: { file: z.string().optional(), nodeId: z.string().optional(), depth: z.number().int().min(0).max(10).optional(), annotations: z.boolean().optional() },
    },
    async ({ file, nodeId, depth, annotations }) => {
      const { path, doc } = await host.getDocument(file);
      if (nodeId) {
        const n = subtree(doc, nodeId, depth ?? 3);
        if (!n) return errorResult(`unknown node ${nodeId}`);
        return text({ path, node: n });
      }
      const s = summarize(doc);
      return text({ path, ...s, tokens: doc.tokens, ...(annotations ? { annotations: doc.annotations ?? {} } : {}) });
    },
  );

  server.registerTool(
    "design_apply",
    {
      title: "Apply ops",
      description: "Apply a batch of ops atomically (create/update/move/delete nodes, frames, pages, folders, tokens, annotations). Returns changed ids or validation errors. Reference tokens as \"$name\" — never hardcode colors/spacing that exist as tokens.",
      inputSchema: { file: z.string().optional(), ops: z.array(OpSchema).min(1) },
    },
    async ({ file, ops }) => {
      const r = await host.applyOps(file, ops as Op[]);
      if (r.errors?.length) return errorResult(`validation failed; nothing applied:\n${r.errors.map((e) => `op[${e.op}]: ${e.message}`).join("\n")}`);
      return text({
        path: r.path,
        changed: r.changed,
        hint: "Call design_screenshot on the affected frame; use design_inspect if layout/overlap looks wrong.",
      });
    },
  );

  server.registerTool(
    "design_screenshot",
    {
      title: "Screenshot frame",
      description: "Render a frame (or any node) to PNG so you can verify your work. Requires the design file to be open in the editor.",
      inputSchema: { file: z.string().optional(), nodeId: z.string(), scale: z.number().min(0.25).max(3).optional() },
    },
    async ({ file, nodeId, scale }) => {
      if (!host.screenshot) return errorResult("screenshot not available in this host (open the file in the Cursor editor)");
      try {
        const shot = await host.screenshot(file, nodeId, scale ?? 1);
        return { content: [{ type: "image" as const, data: shot.png, mimeType: "image/png" }, { type: "text" as const, text: `${nodeId} ${shot.width}×${shot.height}` }] };
      } catch (e) {
        return errorResult(`screenshot failed: ${(e as Error).message}`);
      }
    },
  );

  server.registerTool(
    "design_inspect",
    {
      title: "Inspect layout",
      description:
        "Measure rendered layout for a frame/node: bounds, hierarchy boxes, overlaps, clipping, text overflow, and key computed styles. Use after design_apply when spacing looks wrong — pairs with design_screenshot. Requires the file open in the editor.",
      inputSchema: {
        file: z.string().optional(),
        nodeId: z.string(),
        depth: z.number().int().min(0).max(12).optional(),
      },
    },
    async ({ file, nodeId, depth }) => {
      if (!host.inspect) return errorResult("inspect not available in this host (open the file in the Cursor editor)");
      try {
        const report = await host.inspect(file, nodeId, depth ?? 4);
        const summary = {
          rootId: report.rootId,
          size: `${report.width}×${report.height}`,
          nodeCount: report.nodes.length,
          overlapCount: report.overlaps.length,
          issueCount: report.issues.length,
          issues: report.issues.slice(0, 40),
        };
        return text({ path: (await host.getDocument(file)).path, summary, report });
      } catch (e) {
        return errorResult(`inspect failed: ${(e as Error).message}`);
      }
    },
  );

  server.registerTool(
    "design_select",
    { title: "Select nodes", description: "Highlight nodes in the editor and scroll them into view.", inputSchema: { file: z.string().optional(), nodeIds: z.array(z.string()).min(1) } },
    async ({ file, nodeIds }) => {
      if (!host.select) return errorResult("select not available in this host");
      await host.select(file, nodeIds);
      return text({ selected: nodeIds });
    },
  );

  server.registerTool(
    "design_get_selection",
    { title: "Get selection", description: "What the user has selected in the editor, plus open annotations on those nodes.", inputSchema: { file: z.string().optional() } },
    async ({ file }) => {
      if (!host.getSelection) return errorResult("selection not available in this host");
      const sel = await host.getSelection(file);
      const { doc } = await host.getDocument(sel.path);
      const nodes = sel.ids.map((id) => doc.nodes[id]).filter(Boolean) as Node[];
      const annotations = Object.fromEntries(Object.entries(doc.annotations ?? {}).filter(([, a]) => a.status === "open" && sel.ids.includes(a.nodeId)));
      return text({ path: sel.path, ids: sel.ids, nodes, annotations });
    },
  );

  server.registerTool(
    "design_tokens",
    {
      title: "Design tokens",
      description: "Design-system API. list (optionally by group), get, set, batchSet, delete, usages. Always list tokens before inventing colors/spacing/type.",
      inputSchema: {
        file: z.string().optional(),
        action: z.enum(["list", "get", "set", "batchSet", "delete", "usages"]),
        group: z.string().optional(),
        name: z.string().optional(),
        token: TokenSchema.optional(),
        tokens: z.record(TokenSchema).optional(),
      },
    },
    async ({ file, action, group, name, token, tokens }) => {
      const { path, doc } = await host.getDocument(file);
      switch (action) {
        case "list": {
          const entries = Object.entries(doc.tokens).filter(([, t]) => !group || t.group === group);
          return text({ path, tokens: Object.fromEntries(entries) });
        }
        case "get":
          if (!name) return errorResult("name required");
          return doc.tokens[name] ? text({ name, token: doc.tokens[name] }) : errorResult(`unknown token ${name}`);
        case "usages":
          if (!name) return errorResult("name required");
          return text({ name, usages: tokenUsages(doc, name) });
        case "set": {
          if (!name || !token) return errorResult("name and token required");
          const r = await host.applyOps(path, [{ op: "setToken", name, token }]);
          return r.errors ? errorResult(JSON.stringify(r.errors)) : text({ set: name });
        }
        case "batchSet": {
          if (!tokens) return errorResult("tokens required");
          const ops: Op[] = Object.entries(tokens).map(([n, t]) => ({ op: "setToken", name: n, token: t }));
          const r = await host.applyOps(path, ops);
          return r.errors ? errorResult(JSON.stringify(r.errors)) : text({ set: Object.keys(tokens) });
        }
        case "delete": {
          if (!name) return errorResult("name required");
          const usages = tokenUsages(doc, name);
          if (usages.length) return errorResult(`token ${name} is used by ${usages.length} node props; replace refs first: ${JSON.stringify(usages)}`);
          const r = await host.applyOps(path, [{ op: "setToken", name, token: null }]);
          return r.errors ? errorResult(JSON.stringify(r.errors)) : text({ deleted: name });
        }
      }
    },
  );

  server.registerTool(
    "design_components",
    {
      title: "Components",
      description:
        "List/get reusable components, promote a frame to a component, update/delete defs, or instantiate. Prefer components for repeated buttons/rows; restyle via props/variants instead of rebuilding.",
      inputSchema: {
        file: z.string().optional(),
        action: z.enum(["list", "get", "create", "update", "delete", "instantiate", "usages"]),
        id: z.string().optional(),
        name: z.string().optional(),
        root: z.string().optional(),
        component: ComponentDefSchema.optional(),
        parent: z.string().optional(),
        index: z.number().optional(),
        props: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
        instanceName: z.string().optional(),
        width: z.union([z.number(), z.literal("fill"), z.literal("hug")]).optional(),
        height: z.union([z.number(), z.literal("fill"), z.literal("hug")]).optional(),
      },
    },
    async ({ file, action, id, name, root, component, parent, index, props, instanceName, width, height }) => {
      const { path, doc } = await host.getDocument(file);
      switch (action) {
        case "list":
          return text({
            path,
            components: listComponents(doc).map((c) => ({
              id: c.id,
              name: c.name,
              root: c.root,
              props: c.props ? Object.keys(c.props) : [],
              variants: c.variants ? Object.keys(c.variants) : [],
              usages: componentUsages(doc, c.id).length,
            })),
          });
        case "get":
          if (!id) return errorResult("id required");
          return doc.components?.[id] ? text({ path, component: doc.components[id], usages: componentUsages(doc, id) }) : errorResult(`unknown component ${id}`);
        case "usages":
          if (!id) return errorResult("id required");
          return text({ path, id, usages: componentUsages(doc, id) });
        case "create": {
          if (!name || !root) return errorResult("name and root (frame id) required");
          const r = await host.applyOps(path, [
            {
              op: "createComponent",
              id,
              name,
              root,
              props: component?.props,
              variants: component?.variants,
              variantProp: component?.variantProp,
              description: component?.description,
            },
          ]);
          return r.errors?.length ? errorResult(JSON.stringify(r.errors)) : text({ path, created: r.changed, hint: "Instantiate with action:instantiate" });
        }
        case "update": {
          if (!id || !component) return errorResult("id and component required");
          const r = await host.applyOps(path, [{ op: "setComponent", id, component: { ...component, id } }]);
          return r.errors?.length ? errorResult(JSON.stringify(r.errors)) : text({ path, updated: id });
        }
        case "delete": {
          if (!id) return errorResult("id required");
          const r = await host.applyOps(path, [{ op: "setComponent", id, component: null }]);
          return r.errors?.length ? errorResult(JSON.stringify(r.errors)) : text({ path, deleted: id });
        }
        case "instantiate": {
          if (!id || !parent) return errorResult("id (component) and parent (frame) required");
          if (!doc.components?.[id]) return errorResult(`unknown component ${id}`);
          const r = await host.applyOps(path, [
            {
              op: "create",
              parent,
              index,
              node: {
                type: "instance",
                name: instanceName ?? doc.components[id].name,
                component: id,
                props,
                width: width ?? "fill",
                height: height ?? 48,
              },
            },
          ]);
          return r.errors?.length ? errorResult(JSON.stringify(r.errors)) : text({ path, created: r.changed });
        }
      }
    },
  );

  return server;
}
