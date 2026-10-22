import { test } from "node:test";
import assert from "node:assert/strict";
import { applyOps, sampleDoc, serialize, parse, validate, indexParents, tokenUsages, ICON_NAMES, withPrimitiveCatalog } from "./index";

test("create + undo round-trips", () => {
  const doc = sampleDoc();
  const r = applyOps(doc, [{ op: "create", parent: "fr_login", node: { id: "bt_blue", type: "frame", fill: "#1D4ED8", width: "fill", height: 44, children: [] } }]);
  assert.equal(r.errors, undefined);
  assert.ok(r.doc.nodes.bt_blue);
  assert.ok((r.doc.nodes.fr_login as { children: string[] }).children.includes("bt_blue"));
  const back = applyOps(r.doc, r.inverse);
  assert.equal(serialize(back.doc), serialize(doc));
});

test("atomic batch: one bad op rejects all", () => {
  const doc = sampleDoc();
  const r = applyOps(doc, [
    { op: "update", id: "tx_title", set: { content: "Hi" } },
    { op: "update", id: "nope", set: { content: "x" } },
  ]);
  assert.ok(r.errors && r.errors.length === 1);
  assert.equal(r.doc, doc);
});

test("pages/folders/frames ops keep single-direction refs", () => {
  let { doc } = applyOps(sampleDoc(), [
    { op: "createFolder", id: "fd_mkt", name: "Marketing", parent: null },
    { op: "createPage", id: "pg_web", name: "Web", folder: "fd_mkt" },
    { op: "createFrame", page: "pg_web", frame: { id: "fr_landing", name: "Landing", width: 1280, height: 800 } },
    { op: "moveFrame", id: "fr_login", page: "pg_web" },
    { op: "movePage", id: "pg_sprint", folder: "fd_mkt" },
  ]);
  const idx = indexParents(doc);
  assert.equal(idx.framePage.fr_login, "pg_web");
  assert.equal(idx.pageFolder.pg_sprint, "fd_mkt");
  assert.deepEqual(validate(doc), []);
  const del = applyOps(doc, [{ op: "deletePage", id: "pg_web" }]);
  assert.ok(del.errors, "delete with frames must be blocked without moveFramesTo");
  ({ doc } = applyOps(doc, [{ op: "deletePage", id: "pg_web", moveFramesTo: "pg_sprint" }]));
  assert.deepEqual(doc.pages.pg_sprint.frames, [
    "fr_hero",
    "fr_dash",
    "fr_nextgen",
    "fr_home",
    "fr_drawer",
    "fr_modal",
    "fr_landing",
    "fr_login",
  ]);
  const cyc = applyOps(doc, [{ op: "createFolder", id: "fd_sub", name: "Sub", parent: "fd_mkt" }, { op: "moveFolder", id: "fd_mkt", parent: "fd_sub" }]);
  assert.ok(cyc.errors, "folder cycle must be rejected");
});

test("delete subtree and restore", () => {
  const doc = sampleDoc();
  const r = applyOps(doc, [{ op: "delete", ids: ["bt_submit"] }]);
  assert.ok(!r.doc.nodes.bt_submit);
  const back = applyOps(r.doc, r.inverse);
  assert.equal(back.errors, undefined);
  assert.ok(back.doc.nodes.bt_submit);
  assert.equal(back.doc.nodes.bt_submit?.type, "instance");
  assert.equal(serialize(back.doc), serialize(doc));
});

test("serialize is stable and parses back", () => {
  const doc = sampleDoc();
  const text = serialize(doc);
  const p = parse(text);
  assert.ok(p.ok);
  assert.equal(serialize(p.ok ? p.doc : doc), text);
});

test("tokens: set, usages, overwrite, delete with undo", () => {
  const doc = sampleDoc();
  // add a new color token and reference it
  const r = applyOps(doc, [
    { op: "setToken", name: "color.blue", token: { type: "color", value: "#1D4ED8", modes: { dark: "#3B82F6" } } },
    { op: "create", parent: "fr_login", node: { id: "bt_blue", type: "frame", fill: "$color.blue", width: "fill", height: 44, children: [] } },
  ]);
  assert.equal(r.errors, undefined);
  assert.equal((r.doc.tokens["color.blue"] as { value: string }).value, "#1D4ED8");
  const uses = tokenUsages(r.doc, "color.blue");
  assert.deepEqual(uses, [{ nodeId: "bt_blue", prop: "fill" }]);

  // overwrite value, then undo back to the first value
  const r2 = applyOps(r.doc, [{ op: "setToken", name: "color.blue", token: { type: "color", value: "#2563EB" } }]);
  assert.equal((r2.doc.tokens["color.blue"] as { value: string }).value, "#2563EB");
  const back2 = applyOps(r2.doc, r2.inverse);
  assert.equal((back2.doc.tokens["color.blue"] as { value: string }).value, "#1D4ED8");

  // delete the token, undo restores it with its modes
  const r3 = applyOps(r.doc, [{ op: "setToken", name: "color.blue", token: null }]);
  assert.equal(r3.doc.tokens["color.blue"], undefined);
  const back3 = applyOps(r3.doc, r3.inverse);
  assert.deepEqual((back3.doc.tokens["color.blue"] as { modes: unknown }).modes, { dark: "#3B82F6" });
});

test("annotations: upsert, change status, delete with undo", () => {
  const doc = sampleDoc();
  const r = applyOps(doc, [{ op: "upsertAnnotation", id: "an_1", annotation: { nodeId: "fr_login", body: "tighten padding", status: "open" } }]);
  assert.equal(r.errors, undefined);
  assert.equal(r.doc.annotations?.an_1.status, "open");
  assert.equal(r.doc.annotations?.an_1.nodeId, "fr_login");

  // upsert referencing a missing node fails the whole batch
  const bad = applyOps(r.doc, [{ op: "upsertAnnotation", annotation: { nodeId: "nope", body: "x", status: "open" } }]);
  assert.ok(bad.errors && bad.errors.length === 1);

  // move to sent, then undo back to open
  const r2 = applyOps(r.doc, [{ op: "upsertAnnotation", id: "an_1", annotation: { nodeId: "fr_login", body: "tighten padding", status: "sent" } }]);
  assert.equal(r2.doc.annotations?.an_1.status, "sent");
  const back = applyOps(r2.doc, r2.inverse);
  assert.equal(back.doc.annotations?.an_1.status, "open");

  // delete, undo restores
  const r3 = applyOps(r.doc, [{ op: "deleteAnnotation", ids: ["an_1"] }]);
  assert.equal(r3.doc.annotations?.an_1, undefined);
  const back3 = applyOps(r3.doc, r3.inverse);
  assert.equal(back3.doc.annotations?.an_1.status, "open");
});

test("move/reorder ops: frames across pages, pages into folders, nested folders", () => {
  const doc = sampleDoc();
  // set up: a second + third frame on pg_sprint, a second page, a second folder
  const r = applyOps(doc, [
    { op: "createFrame", frame: { id: "fr_b", type: "frame", name: "B", x: 480, y: 0, width: 390, height: 600, children: [] }, page: "pg_sprint" },
    { op: "createFrame", frame: { id: "fr_c", type: "frame", name: "C", x: 960, y: 0, width: 390, height: 600, children: [] }, page: "pg_sprint" },
    { op: "createPage", id: "pg_two", name: "Two", folder: "fd_app" },
    { op: "createFolder", id: "fd_sub", name: "Sub", parent: null },
  ]);
  assert.equal(r.errors, undefined);
  assert.deepEqual(r.doc.pages.pg_sprint.frames, [
    "fr_login",
    "fr_hero",
    "fr_dash",
    "fr_nextgen",
    "fr_home",
    "fr_drawer",
    "fr_modal",
    "fr_b",
    "fr_c",
  ]);

  // reorder within a page: drop fr_login after fr_b (index 7 → before fr_c)
  const r1 = applyOps(r.doc, [{ op: "moveFrame", id: "fr_login", page: "pg_sprint", index: 7 }]);
  assert.deepEqual(r1.doc.pages.pg_sprint.frames, [
    "fr_hero",
    "fr_dash",
    "fr_nextgen",
    "fr_home",
    "fr_drawer",
    "fr_modal",
    "fr_b",
    "fr_login",
    "fr_c",
  ]);

  // relocate a frame to another page (append)
  const r2 = applyOps(r.doc, [{ op: "moveFrame", id: "fr_c", page: "pg_two" }]);
  assert.deepEqual(r2.doc.pages.pg_sprint.frames, [
    "fr_login",
    "fr_hero",
    "fr_dash",
    "fr_nextgen",
    "fr_home",
    "fr_drawer",
    "fr_modal",
    "fr_b",
  ]);
  assert.deepEqual(r2.doc.pages.pg_two.frames, ["fr_c"]);

  // move a page into a different folder
  const r3 = applyOps(r.doc, [{ op: "movePage", id: "pg_two", folder: "fd_sub" }]);
  assert.ok(r3.doc.folders.fd_sub.children.includes("pg_two"));
  assert.ok(!r3.doc.folders.fd_app.children.includes("pg_two"));

  // nest a folder; undo restores it to the root
  const r4 = applyOps(r.doc, [{ op: "moveFolder", id: "fd_sub", parent: "fd_app" }]);
  assert.ok(r4.doc.folders.fd_app.children.includes("fd_sub"));
  assert.ok(!r4.doc.folderRoot.includes("fd_sub"));
  const back = applyOps(r4.doc, r4.inverse);
  assert.ok(back.doc.folderRoot.includes("fd_sub"));

  // a folder cannot be moved into itself
  const bad = applyOps(r.doc, [{ op: "moveFolder", id: "fd_app", parent: "fd_app" }]);
  assert.ok(bad.errors && bad.errors.length === 1);
});

test("1c.1 expressiveness: gradient fill, per-corner radius, shadow, shadow token round-trip", () => {
  const doc = sampleDoc();
  const r = applyOps(doc, [
    { op: "setToken", name: "shadow.card", token: { type: "shadow", value: [{ x: 0, y: 8, blur: 24, spread: -4, color: "rgba(16,24,40,.12)" }] } },
    { op: "create", parent: "fr_login", node: {
        id: "rc_hero", type: "rect", name: "Hero",
        fill: { kind: "linear", angle: 135, stops: [{ color: "$color.accent", at: 0 }, { color: "#8B5CF6", at: 1 }] },
        radius: [16, 16, 0, 0],
        shadow: "$shadow.card",
        width: "fill", height: 160,
      } },
  ]);
  assert.equal(r.errors, undefined);
  const hero = r.doc.nodes.rc_hero as { fill: { kind: string; stops: unknown[] }; radius: number[]; shadow: string };
  assert.equal(hero.fill.kind, "linear");
  assert.equal(hero.fill.stops.length, 2);
  assert.deepEqual(hero.radius, [16, 16, 0, 0]);
  assert.equal(hero.shadow, "$shadow.card");
  assert.equal((r.doc.tokens["shadow.card"] as { type: string }).type, "shadow");

  // validate + serialize/parse preserves it all
  assert.deepEqual(validate(r.doc), []);
  const p = parse(serialize(r.doc));
  assert.ok(p.ok);
  assert.deepEqual((p.ok && (p.doc.nodes.rc_hero as { radius: unknown }).radius), [16, 16, 0, 0]);

  // inline shadow (not a token) and a radial gradient also validate
  const r2 = applyOps(r.doc, [
    { op: "update", id: "rc_hero", set: { shadow: { x: 0, y: 2, blur: 6, color: "#0003" }, fill: { kind: "radial", stops: [{ color: "#fff", at: 0 }, { color: "#000", at: 1 }] } } },
  ]);
  assert.equal(r2.errors, undefined);
  assert.deepEqual(validate(r2.doc), []);

  // a bad gradient (one stop) applies but fails schema validation (update ops don't deep-validate node props)
  const bad = applyOps(r.doc, [{ op: "update", id: "rc_hero", set: { fill: { kind: "linear", stops: [{ color: "#fff", at: 0 }] } } }]);
  assert.equal(bad.errors, undefined);
  assert.ok(validate(bad.doc).length >= 1, "schema validation flags the one-stop gradient");
});

test("layout margin accepts CSS auto in 4-value shorthand", () => {
  const r = applyOps(sampleDoc(), [
    {
      op: "create",
      parent: "fr_login",
      node: {
        id: "fr_push_end",
        type: "frame",
        width: "hug",
        height: "hug",
        layout: { direction: "column", margin: [0, 0, 0, "auto"] },
        children: [],
      },
    },
  ]);
  assert.equal(r.errors, undefined);
  assert.deepEqual(validate(r.doc), []);
  assert.deepEqual((r.doc.nodes.fr_push_end as { layout?: { margin?: unknown } }).layout?.margin, [0, 0, 0, "auto"]);
});

test("1c.0 composition: absolute layout, image/layered fill, zIndex, backdropBlur, transform, negative margin", () => {
  const doc = sampleDoc();
  // sample already includes fr_hero cinematic card
  assert.equal((doc.nodes.fr_hero as { layout?: { mode?: string } }).layout?.mode, "absolute");
  assert.equal((doc.nodes.fr_hero as { fill?: { kind?: string } }).fill?.kind, "image");
  assert.equal((doc.nodes.rc_hero_scrim as { zIndex?: number }).zIndex, 1);
  assert.deepEqual(validate(doc), []);

  const r = applyOps(doc, [
    {
      op: "create",
      parent: "fr_login",
      node: {
        id: "fr_glass",
        type: "frame",
        name: "Glass dock",
        width: "fill",
        height: 56,
        layout: { direction: "row", align: "center", justify: "center", margin: [-12, 0, 0, 0] },
        fill: "rgba(232,245,240,0.12)",
        backdropBlur: 12,
        radius: "$radius.md",
        children: [],
      },
    },
    {
      op: "create",
      parent: "fr_hero",
      node: {
        id: "rc_peek",
        type: "rect",
        name: "Peek",
        x: 40,
        y: 40,
        width: 120,
        height: 160,
        zIndex: 0,
        fill: "$color.surface",
        radius: 12,
        transform: { x: 8, y: -6, scale: 0.92, rotate: -4 },
      },
    },
    {
      op: "update",
      id: "fr_hero",
      set: {
        fill: [
          { kind: "linear", angle: 180, stops: [{ color: "rgba(11,31,26,0)", at: 0.4 }, { color: "rgba(11,31,26,0.9)", at: 1 }] },
          { kind: "image", src: "https://example.com/hero.jpg", fit: "cover" },
        ],
      },
    },
  ]);
  assert.equal(r.errors, undefined);
  assert.deepEqual(validate(r.doc), []);
  assert.ok(Array.isArray((r.doc.nodes.fr_hero as { fill: unknown }).fill));
  assert.equal((r.doc.nodes.fr_glass as { backdropBlur?: number }).backdropBlur, 12);
  assert.deepEqual((r.doc.nodes.fr_glass as { layout: { margin: unknown } }).layout.margin, [-12, 0, 0, 0]);
  assert.equal((r.doc.nodes.rc_peek as { transform?: { rotate?: number } }).transform?.rotate, -4);

  const p = parse(serialize(r.doc));
  assert.ok(p.ok);
  if (p.ok) {
    assert.ok(Array.isArray(p.doc.nodes.fr_hero.fill));
    assert.equal((p.doc.nodes.rc_peek as { transform?: { scale?: number } }).transform?.scale, 0.92);
  }
});

test("1c.2 primitives: icon, chart, shape round-trip + guide catalog", () => {
  const doc = sampleDoc();
  assert.equal(doc.nodes.ch_week?.type, "chart");
  assert.equal(doc.nodes.ic_bell?.type, "icon");
  assert.ok(ICON_NAMES.includes("bell") && ICON_NAMES.includes("trending-up"));
  assert.deepEqual(validate(doc), []);

  const r = applyOps(doc, [
    {
      op: "create",
      parent: "fr_dash",
      node: {
        id: "ic_star",
        type: "icon",
        name: "star",
        fill: "$color.accent",
        width: 24,
        height: 24,
        strokeWidth: 1.5,
      },
    },
    {
      op: "create",
      parent: "fr_dash",
      node: {
        id: "ch_donut",
        type: "chart",
        width: 160,
        height: 160,
        chart: { kind: "donut", series: [{ values: [40, 25, 35] }] },
      },
    },
    {
      op: "create",
      parent: "fr_dash",
      node: {
        id: "sh_arrow",
        type: "shape",
        kind: "arrow",
        direction: "up",
        width: 48,
        height: 48,
        fill: "$color.accent",
      },
    },
  ]);
  assert.equal(r.errors, undefined);
  assert.deepEqual(validate(r.doc), []);
  const p = parse(serialize(r.doc));
  assert.ok(p.ok);
  if (p.ok) {
    assert.equal((p.doc.nodes.ic_star as { name: string }).name, "star");
    assert.equal((p.doc.nodes.ch_donut as { chart: { kind: string } }).chart.kind, "donut");
    assert.equal((p.doc.nodes.sh_arrow as { kind: string }).kind, "arrow");
  }

  const guide = withPrimitiveCatalog("# skill");
  assert.ok(guide.includes("Available icon names"));
  assert.ok(guide.includes("bell"));
  assert.ok(guide.includes('"bar"') && guide.includes('"donut"'));
  assert.ok(guide.includes("### shape"));
});

test("1c.4 expressiveness + widgets: blur, mask, conic, video, sparkline, avatar, progress, skeleton", () => {
  const doc = sampleDoc();
  assert.equal(doc.nodes.fr_nextgen?.type, "frame");
  assert.equal(doc.nodes.av_ng_a?.type, "avatar");
  assert.equal(doc.nodes.pr_ng_linear?.type, "progress");
  assert.equal(doc.nodes.sk_ng_block?.type, "skeleton");
  assert.equal((doc.nodes.ch_ng_spark as { chart: { kind: string } }).chart.kind, "sparkline");
  assert.deepEqual(validate(doc), []);

  const r = applyOps(doc, [
    {
      op: "create",
      parent: "fr_nextgen",
      node: {
        id: "rc_ng_fx",
        type: "rect",
        name: "FX layer",
        width: "fill",
        height: 80,
        blur: 4,
        mixBlendMode: "multiply",
        mask: { kind: "linear", angle: 180, stops: [{ color: "#000", at: 0 }, { color: "transparent", at: 1 }] },
        clipPath: { kind: "inset", args: [0, 0, 10, 0] },
        outline: { color: "$color.accent", width: 2, offset: 2 },
        fill: {
          kind: "conic",
          angle: 45,
          stops: [
            { color: "$color.accent", at: 0 },
            { color: "#8B5CF6", at: 1 },
          ],
        },
      },
    },
    {
      op: "create",
      parent: "fr_nextgen",
      node: {
        id: "fr_ng_video",
        type: "frame",
        name: "Video card",
        width: "fill",
        height: 120,
        clip: true,
        radius: 12,
        children: [],
        fill: [
          { kind: "linear", angle: 180, stops: [{ color: "rgba(0,0,0,0)", at: 0.4 }, { color: "rgba(0,0,0,0.6)", at: 1 }] },
          { kind: "video", src: "https://example.com/clip.mp4", fit: "cover", muted: true, loop: true },
        ],
      },
    },
    {
      op: "create",
      parent: "fr_nextgen",
      node: {
        id: "sh_ng_line",
        type: "shape",
        name: "Divider line",
        kind: "line",
        direction: "horizontal",
        width: "fill",
        height: 8,
        fill: "$color.muted",
      },
    },
    {
      op: "create",
      parent: "fr_nextgen",
      node: {
        id: "av_ng_c",
        type: "avatar",
        name: "Avatar C",
        initials: "MX",
        size: 36,
        fill: "$color.surface",
        textFill: "$color.text",
      },
    },
  ]);
  assert.equal(r.errors, undefined, JSON.stringify(r.errors));
  assert.deepEqual(validate(r.doc), []);
  const p = parse(serialize(r.doc));
  assert.ok(p.ok);
  if (p.ok) {
    const fx = p.doc.nodes.rc_ng_fx as { blur: number; mixBlendMode: string; fill: { kind: string }; mask: { kind: string } };
    assert.equal(fx.blur, 4);
    assert.equal(fx.mixBlendMode, "multiply");
    assert.equal(fx.fill.kind, "conic");
    assert.equal(fx.mask.kind, "linear");
    const vid = p.doc.nodes.fr_ng_video as { fill: unknown[] };
    assert.ok(Array.isArray(vid.fill) && (vid.fill[1] as { kind: string }).kind === "video");
    assert.equal((p.doc.nodes.sh_ng_line as { kind: string }).kind, "line");
    assert.equal(p.doc.nodes.av_ng_c.type, "avatar");
  }

  const guide = withPrimitiveCatalog("# skill");
  assert.ok(guide.includes("### avatar"));
  assert.ok(guide.includes("### progress"));
  assert.ok(guide.includes("### skeleton"));
  assert.ok(guide.includes("sparkline"));
  assert.ok(guide.includes("Layer blur") || guide.includes("`blur`"));
  assert.ok(guide.includes("Taste pack"), "design_guide injects taste pack");
  assert.ok(guide.includes("persuade") && guide.includes("operate"));
  assert.ok(guide.includes("sparkline") && guide.includes("Hard bans"));
  assert.ok(guide.includes("chrome") && guide.includes("rounded") && guide.includes("stacked"), "1c.5 chart style in guide");
});

test("1c.5 chart style options round-trip", () => {
  const doc = sampleDoc();
  const week = doc.nodes.ch_week as { chart: { options?: Record<string, unknown> } };
  assert.equal(week.chart.options?.chrome, "minimal");
  assert.equal(week.chart.options?.rounded, true);
  assert.equal(week.chart.options?.highlight, 5);

  const r = applyOps(doc, [
    {
      op: "create",
      parent: "fr_dash",
      node: {
        id: "ch_styled",
        type: "chart",
        name: "Styled bars",
        width: 280,
        height: 160,
        chart: {
          kind: "bar",
          labels: ["A", "B", "C"],
          series: [
            { color: "$color.accent", values: [3, 5, 2] },
            { color: "$color.muted", values: [1, 2, 4] },
          ],
          options: {
            chrome: "none",
            rounded: 8,
            stacked: true,
            goal: 6,
            valueLabels: true,
            strokeWidth: 3,
            fillOpacity: 0.3,
            showDots: false,
          },
        },
      },
    },
  ]);
  assert.equal(r.errors, undefined, JSON.stringify(r.errors));
  assert.deepEqual(validate(r.doc), []);
  const p = parse(serialize(r.doc));
  assert.ok(p.ok);
  if (p.ok) {
    const opts = (p.doc.nodes.ch_styled as { chart: { options: Record<string, unknown> } }).chart.options;
    assert.equal(opts.chrome, "none");
    assert.equal(opts.stacked, true);
    assert.equal(opts.rounded, 8);
    assert.equal(opts.goal, 6);
    assert.equal(opts.valueLabels, true);
  }
});
