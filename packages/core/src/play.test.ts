import assert from "node:assert/strict";
import { test } from "node:test";
import {
  findLinkOnNode,
  initialPlayState,
  playBack,
  playCanBack,
  playFollowLink,
  sampleDoc,
  transitionClass,
  validate,
} from "./index";

test("sample overlay links validate", () => {
  const doc = sampleDoc();
  assert.deepEqual(validate(doc), []);
  const openDrawer = doc.nodes.bt_open_drawer?.link;
  assert.equal(openDrawer?.to, "fr_drawer");
  assert.equal(openDrawer?.present, "overlay");
  assert.equal(openDrawer?.transition, "slide-left");
  assert.equal(doc.nodes.bt_open_modal?.link?.present, "overlay");
  assert.equal(doc.nodes.bt_submit?.link?.present, "navigate");
  assert.equal(doc.tokens["motion.fast"]?.type, "number");
});

test("playFollowLink stacks overlays and dismisses to base", () => {
  let s = initialPlayState("fr_home");
  s = playFollowLink(s, { to: "fr_drawer", present: "overlay", transition: "slide-left" });
  assert.deepEqual(s.overlays, ["fr_drawer"]);
  assert.equal(s.frameId, "fr_home");
  s = playFollowLink(s, { to: "fr_modal", present: "overlay", transition: "fade" });
  assert.deepEqual(s.overlays, ["fr_drawer", "fr_modal"]);
  s = playFollowLink(s, { to: "fr_home", present: "navigate" });
  assert.deepEqual(s.overlays, []);
  assert.equal(s.trail.length, 0);
});

test("playBack pops overlay then trail", () => {
  let s = initialPlayState("fr_login");
  s = playFollowLink(s, { to: "fr_home", present: "navigate", transition: "fade" });
  assert.equal(s.frameId, "fr_home");
  assert.ok(playCanBack(s));
  s = playFollowLink(s, { to: "fr_drawer", present: "overlay" });
  s = playBack(s);
  assert.deepEqual(s.overlays, []);
  assert.equal(s.frameId, "fr_home");
  s = playBack(s);
  assert.equal(s.frameId, "fr_login");
  assert.equal(playCanBack(s), false);
});

test("findLinkOnNode walks parents", () => {
  const doc = sampleDoc();
  const link = findLinkOnNode(doc, "tx_open_drawer");
  assert.equal(link?.to, "fr_drawer");
  assert.equal(link?.present, "overlay");
});

test("transitionClass maps slide and push", () => {
  assert.equal(transitionClass("slide-up"), "play-enter--slide-up");
  assert.equal(transitionClass("push"), "play-enter--slide-left");
  assert.equal(transitionClass("instant"), "play-enter--instant");
  assert.equal(transitionClass(undefined), "play-enter--fade");
});
