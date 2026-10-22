import { test } from "node:test";
import assert from "node:assert/strict";
import { applyOps, sampleDoc } from "./index";
import { defaultDisplayName, ensureNodeName, humanizeId, isGenericName, nodeDisplayLabel } from "./naming";

test("humanizeId strips role prefixes", () => {
  assert.equal(humanizeId("auth_logo_row"), "Auth Logo Row");
  assert.equal(humanizeId("fr_home"), "Home");
  assert.equal(humanizeId("in_auth_email"), "Auth Email");
  assert.equal(humanizeId("bt_sign_in"), "Sign In");
});

test("isGenericName rejects type-as-name", () => {
  assert.equal(isGenericName(undefined), true);
  assert.equal(isGenericName("frame"), true);
  assert.equal(isGenericName("Email input"), false);
});

test("ensureNodeName fills missing frame names from id", () => {
  const n = { id: "in_auth_email", type: "frame", children: [] } as Parameters<typeof ensureNodeName>[0];
  ensureNodeName(n);
  assert.equal(n.name, "Auth Email");
});

test("ensureNodeName leaves Lucide icon names alone", () => {
  const n = { id: "ic_email", type: "icon", name: "mail", width: 16, height: 16 } as Parameters<typeof ensureNodeName>[0];
  ensureNodeName(n);
  assert.equal(n.name, "mail");
  assert.equal(nodeDisplayLabel(n, n.id), "Icon · mail");
});

test("create auto-names unnamed frames", () => {
  const r = applyOps(sampleDoc(), [
    { op: "create", parent: "fr_login", node: { id: "row_actions", type: "frame", width: "fill", height: "hug", children: [] } },
  ]);
  assert.equal(r.errors, undefined);
  assert.equal(r.doc.nodes.row_actions.name, "Actions");
});

test("createFrame auto-names when name omitted", () => {
  const r = applyOps(sampleDoc(), [
    { op: "createPage", id: "pg_x", name: "X", folder: null },
    { op: "createFrame", page: "pg_x", frame: { id: "fr_settings", width: 390, height: 844 } },
  ]);
  assert.equal(r.errors, undefined);
  assert.equal(r.doc.nodes.fr_settings.name, "Settings");
});

test("defaultDisplayName for text uses content", () => {
  assert.equal(
    defaultDisplayName({ id: "tx_a", type: "text", content: "Keep me signed in" }),
    "Keep me signed in",
  );
});
