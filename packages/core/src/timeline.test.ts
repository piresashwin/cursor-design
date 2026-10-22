import { test } from "node:test";
import assert from "node:assert/strict";
import { applyOps, sampleDoc, validate } from "./index";
import { applyMotionSamples, sampleTimeline, timelineT } from "./timeline";

test("timelineT clamps and loops", () => {
  const tl = { id: "tl", frameId: "fr", duration: 1000, tracks: [] };
  assert.equal(timelineT(tl, -100), 0);
  assert.equal(timelineT(tl, 0), 0);
  assert.equal(timelineT(tl, 500), 0.5);
  assert.equal(timelineT(tl, 1000), 1);
  assert.equal(timelineT(tl, 1500), 1);
  assert.equal(timelineT({ ...tl, loop: true }, 1500), 0.5);
  assert.equal(timelineT({ ...tl, loop: true }, 2000), 0);
});

test("sampleTimeline interpolates opacity and transform", () => {
  const tl = {
    id: "tl_fade",
    frameId: "fr_login",
    duration: 1000,
    tracks: [
      {
        nodeId: "tx_title",
        channel: "opacity" as const,
        keys: [
          { t: 0, value: 0, ease: "linear" as const },
          { t: 1, value: 1, ease: "linear" as const },
        ],
      },
      {
        nodeId: "tx_title",
        channel: "transform.y" as const,
        keys: [
          { t: 0, value: 12, ease: "linear" as const },
          { t: 1, value: 0, ease: "linear" as const },
        ],
      },
    ],
  };
  const mid = sampleTimeline(tl, 500);
  assert.ok(Math.abs((mid.tx_title.opacity ?? -1) - 0.5) < 1e-6);
  assert.ok(Math.abs((mid.tx_title.transform?.y ?? -1) - 6) < 1e-6);
  const end = sampleTimeline(tl, 1000);
  assert.equal(end.tx_title.opacity, 1);
  assert.equal(end.tx_title.transform?.y, 0);
});

test("setTimeline op + applyMotionSamples", () => {
  const r = applyOps(sampleDoc(), [
    {
      op: "setTimeline",
      id: "tl_login_in",
      timeline: {
        id: "tl_login_in",
        name: "Login enter",
        frameId: "fr_login",
        duration: 400,
        tracks: [
          {
            nodeId: "tx_title",
            channel: "opacity",
            keys: [
              { t: 0, value: 0 },
              { t: 1, value: 1 },
            ],
          },
        ],
      },
    },
  ]);
  assert.equal(r.errors, undefined);
  assert.deepEqual(validate(r.doc), []);
  assert.ok(r.doc.timelines?.tl_login_in);

  const samples = sampleTimeline(r.doc.timelines!.tl_login_in, 0);
  const posed = applyMotionSamples(r.doc, samples);
  assert.equal(posed.nodes.tx_title.opacity, 0);

  const bad = applyOps(r.doc, [
    {
      op: "setTimeline",
      id: "tl_bad",
      timeline: {
        id: "tl_bad",
        frameId: "fr_login",
        duration: 200,
        tracks: [{ nodeId: "fr_home", channel: "opacity", keys: [{ t: 0, value: 1 }] }],
      },
    },
  ]);
  assert.ok(bad.errors?.length, "rejects track nodes outside frame");
});
