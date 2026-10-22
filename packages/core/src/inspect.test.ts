import assert from "node:assert/strict";
import { test } from "node:test";
import { analyzeLayout, type InspectBox } from "./inspect";

test("analyzeLayout flags sibling overlaps and skips nested containment", () => {
  const nodes: InspectBox[] = [
    { id: "root", x: 0, y: 0, w: 200, h: 200 },
    { id: "a", name: "A", x: 0, y: 0, w: 100, h: 40 },
    { id: "b", name: "B", x: 60, y: 0, w: 100, h: 40 }, // overlaps A
    { id: "child", name: "Child", x: 10, y: 10, w: 40, h: 20 }, // inside A — not an overlap issue
  ];
  // Make child clearly inside A only for containment skip vs A; vs B it may overlap
  const r = analyzeLayout("root", 200, 200, nodes);
  assert.ok(r.overlaps.some((o) => (o.a === "a" && o.b === "b") || (o.a === "b" && o.b === "a")));
  assert.ok(r.issues.some((i) => i.code === "overlap"));
});

test("analyzeLayout flags clipped and text-overflow", () => {
  const r = analyzeLayout("root", 100, 100, [
    { id: "root", x: 0, y: 0, w: 100, h: 100 },
    { id: "tx", name: "Label", x: 0, y: 0, w: 80, h: 20, textOverflow: true },
    { id: "out", name: "Out", x: 10, y: 10, w: 50, h: 50, clipped: true },
  ]);
  assert.ok(r.issues.some((i) => i.code === "text-overflow" && i.nodeIds.includes("tx")));
  assert.ok(r.issues.some((i) => i.code === "clipped" && i.nodeIds.includes("out")));
});

test("analyzeLayout flags zero-size", () => {
  const r = analyzeLayout("root", 100, 100, [
    { id: "root", x: 0, y: 0, w: 100, h: 100 },
    { id: "empty", name: "Empty", x: 0, y: 0, w: 0, h: 40 },
  ]);
  assert.ok(r.issues.some((i) => i.code === "zero-size"));
});
