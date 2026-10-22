import { test } from "node:test";
import assert from "node:assert/strict";
import { collectFontFamilies, primaryFamily } from "../src/fonts.ts";
import type { Doc } from "@cursor-design/core";

test("primaryFamily strips stacks and generics", () => {
  assert.equal(primaryFamily("Fraunces, Georgia, serif"), "Fraunces");
  assert.equal(primaryFamily('"Plus Jakarta Sans", system-ui, sans-serif'), "Plus Jakarta Sans");
  assert.equal(primaryFamily("system-ui, sans-serif"), null);
  assert.equal(primaryFamily("Georgia, serif"), null);
});

test("collectFontFamilies reads tokens and inline fonts", () => {
  const doc = {
    schemaVersion: 1,
    name: "t",
    tokens: {
      "type.display": { type: "font", family: "Fraunces, Georgia, serif", size: 40, weight: 600 },
      "type.body": { type: "font", family: "system-ui, sans-serif", size: 14 },
      "color.text": { type: "color", value: "#000" },
    },
    pages: {},
    nodes: {
      tx_a: {
        id: "tx_a",
        type: "text",
        content: "Hi",
        font: { family: "Inter, sans-serif", size: 16 },
      },
    },
    folderRoot: [],
    folders: {},
  } as unknown as Doc;
  assert.deepEqual(collectFontFamilies(doc), ["Fraunces", "Inter"]);
});
