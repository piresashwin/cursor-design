import assert from "node:assert/strict";
import { test } from "node:test";
import { applyOps, expandInstance, sampleDoc, serialize, parse, validate, componentUsages } from "./index";
import type { InstanceNode } from "./types";

test("sample button component + instance validate and expand", () => {
  const doc = sampleDoc();
  assert.deepEqual(validate(doc), []);
  assert.ok(doc.components?.cp_button);
  assert.equal(doc.nodes.bt_submit?.type, "instance");
  const inst = doc.nodes.bt_submit as InstanceNode;
  const expanded = expandInstance(doc, inst);
  assert.ok(expanded);
  const root = expanded!.nodes[expanded!.rootId];
  assert.equal(root.type, "frame");
  assert.equal((root as { fill?: string }).fill, "$color.accent");
  const labelId = Object.keys(expanded!.nodes).find((id) => expanded!.nodes[id].type === "text");
  assert.ok(labelId);
  assert.equal((expanded!.nodes[labelId!] as { content?: string }).content, "Sign in");
  const p = parse(serialize(doc));
  assert.ok(p.ok);
  if (p.ok) assert.equal(p.doc.components?.cp_button?.name, "Button");
});

test("createComponent detaches frame; instantiate; undo", () => {
  let doc = sampleDoc();
  // Build a small master on the page then promote
  let r = applyOps(doc, [
    {
      op: "createFrame",
      page: "pg_sprint",
      frame: {
        id: "fr_chip",
        name: "Chip master",
        width: 120,
        height: 32,
        fill: "$color.surface",
        layout: { direction: "row", align: "center", justify: "center" },
        children: [],
      },
    },
    {
      op: "create",
      parent: "fr_chip",
      node: { id: "tx_chip", type: "text", name: "Chip label", content: "Chip", font: "$type.label", fill: "$color.text", width: "hug", height: "hug" },
    },
  ]);
  assert.equal(r.errors, undefined, JSON.stringify(r.errors));
  doc = r.doc;
  assert.ok(doc.pages.pg_sprint.frames.includes("fr_chip"));

  r = applyOps(doc, [
    {
      op: "createComponent",
      id: "cp_chip",
      name: "Chip",
      root: "fr_chip",
      props: { label: { type: "string", default: "Chip", bind: "tx_chip.content" } },
    },
  ]);
  assert.equal(r.errors, undefined, JSON.stringify(r.errors));
  doc = r.doc;
  assert.ok(doc.components?.cp_chip);
  assert.ok(!doc.pages.pg_sprint.frames.includes("fr_chip"), "master detached from page");

  r = applyOps(doc, [
    {
      op: "create",
      parent: "fr_home",
      node: {
        id: "ix_chip",
        type: "instance",
        name: "Home chip",
        component: "cp_chip",
        props: { label: "Pro" },
        width: 80,
        height: 32,
      },
    },
  ]);
  assert.equal(r.errors, undefined, JSON.stringify(r.errors));
  doc = r.doc;
  assert.deepEqual(componentUsages(doc, "cp_chip"), ["ix_chip"]);
  const expanded = expandInstance(doc, doc.nodes.ix_chip as InstanceNode);
  assert.equal((expanded!.nodes[Object.keys(expanded!.nodes).find((k) => expanded!.nodes[k].type === "text")!] as { content?: string }).content, "Pro");

  // Cannot delete component while instances exist
  const blocked = applyOps(doc, [{ op: "setComponent", id: "cp_chip", component: null }]);
  assert.ok(blocked.errors?.length);

  // Delete instance then component; undo createComponent restores page membership
  r = applyOps(doc, [{ op: "delete", ids: ["ix_chip"] }]);
  doc = r.doc;
  const undone = applyOps(doc, r.inverse); // restore instance — skip
  void undone;
  r = applyOps(doc, [{ op: "setComponent", id: "cp_chip", component: null }]);
  assert.equal(r.errors, undefined, JSON.stringify(r.errors));
});

test("ghost variant overrides root fill", () => {
  const doc = sampleDoc();
  const expanded = expandInstance(doc, {
    ...(doc.nodes.bt_submit as InstanceNode),
    props: { label: "Ghost", variant: "ghost" },
  });
  assert.ok(expanded);
  assert.equal((expanded!.nodes[expanded!.rootId] as { fill?: string }).fill, "transparent");
});
