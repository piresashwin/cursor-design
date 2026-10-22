// Headless check of the built editor bundle in standalone mode: renders, applies an op, screenshots via html-to-image.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, "../dist");
const pwPath = process.env.PLAYWRIGHT_MODULE ?? "playwright";

test("standalone editor renders, applies ops, screenshots", async (t) => {
  let pw: typeof import("playwright");
  try {
    const mod = (await import(pwPath)) as Record<string, unknown>;
    // Under some loaders a CJS build lands entirely under `default`.
    pw = (mod.chromium ? mod : (mod.default as unknown)) as typeof import("playwright");
  } catch {
    t.skip(`playwright not available (set PLAYWRIGHT_MODULE)`);
    return;
  }
  const html = await fs.readFile(path.join(dist, "index.html"), "utf8");
  const browser = await pw.chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.route("**/*", async (route) => {
      const u = new URL(route.request().url());
      if (u.pathname === "/") return route.fulfill({ body: html, contentType: "text/html" });
      try {
        const body = await fs.readFile(path.join(dist, u.pathname));
        return route.fulfill({ body, contentType: u.pathname.endsWith(".js") ? "text/javascript" : u.pathname.endsWith(".css") ? "text/css" : "application/octet-stream" });
      } catch {
        return route.fulfill({ status: 404 });
      }
    });
    await page.goto("http://editor.local/");
    await page.waitForSelector('[data-node-id="fr_login"]');
    assert.equal(await page.locator('[data-node-id="tx_title"]').innerText(), "Welcome back");

    // apply an op through the fake host
    await page.evaluate(() =>
      (window as unknown as { __editor: { applyOps(o: unknown[]): void } }).__editor.applyOps([
        { op: "create", parent: "fr_login", index: 5, node: { id: "bt_blue", type: "frame", name: "Blue button", fill: "#1D4ED8", width: "fill", height: 44, radius: 10, layout: { direction: "row", align: "center", justify: "center" }, children: [] } },
        { op: "create", parent: "bt_blue", node: { id: "tx_blue", type: "text", content: "Blue", fill: "#fff", width: "hug", height: "hug" } },
      ]),
    );
    await page.waitForSelector('[data-node-id="bt_blue"]');
    const bg = await page.locator('[data-node-id="bt_blue"]').evaluate((el) => getComputedStyle(el).backgroundColor);
    assert.equal(bg, "rgb(29, 78, 216)");

    // screenshot via html-to-image
    const shot = await page.evaluate(() => (window as unknown as { __editor: { screenshot(id: string, s: number): Promise<{ png: string; width: number; height: number }> } }).__editor.screenshot("fr_login", 1));
    assert.ok(shot.png.length > 1000, "png is non-trivial");
    assert.equal(shot.width, 390);
    const buf = Buffer.from(shot.png, "base64");
    assert.equal(buf.subarray(1, 4).toString(), "PNG");
    await fs.mkdir(path.join(here, "../.test-out"), { recursive: true });
    await fs.writeFile(path.join(here, "../.test-out/fr_login.png"), buf);

    // inspect: measured bounds + issues list
    const report = await page.evaluate(() =>
      (window as unknown as { __editor: { inspect(id: string, depth?: number): Promise<{ rootId: string; width: number; nodes: unknown[]; issues: unknown[] }> } }).__editor.inspect(
        "fr_login",
        3,
      ),
    );
    assert.equal(report.rootId, "fr_login");
    assert.equal(report.width, 390);
    assert.ok(report.nodes.length >= 2, "inspect returns descendant boxes");
    assert.ok(Array.isArray(report.issues));

    // select via host → overlay shows
    await page.evaluate(() => (window as unknown as { __editor: { select(ids: string[]): void } }).__editor.select(["bt_blue"]));
    await page.waitForSelector("svg.overlay rect.sel");
    assert.deepEqual(errors, []);

    // --- resize: drag the SE handle of fr_login and confirm width/height commit ---
    await page.evaluate(() => (window as unknown as { __editor: { select(ids: string[]): void } }).__editor.select(["fr_login"]));
    const getW = () => page.evaluate(() => (window as unknown as { __editor: { getDoc(): { nodes: Record<string, { width?: unknown }> } } }).__editor.getDoc().nodes.fr_login.width);
    const w0 = await getW();
    const se = await page.waitForSelector('svg.overlay rect.handle[data-corner="se"]');
    const box = (await se.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 40, box.y + 24, { steps: 4 });
    await page.mouse.up();
    const w1 = await getW();
    assert.equal(typeof w1, "number", "width committed as a number");
    assert.ok((w1 as number) > (typeof w0 === "number" ? w0 : 0), `width grew (${String(w0)} -> ${String(w1)})`);

    // --- tokens panel: switch tab, edit a color token value ---
    await page.click('.seg button:text-is("Tokens")');
    await page.waitForSelector(".tok");
    const firstTokName = await page.locator(".tok .tok-name").first().innerText();
    const name = firstTokName.replace(/^\$/, "");
    await page.locator(".tok .tok-val").first().fill("#0a0b0c");
    await page.locator(".tok .tok-val").first().press("Enter");
    const tokVal = await page.evaluate(
      (n) => (window as unknown as { __editor: { getDoc(): { tokens: Record<string, { value?: unknown }> } } }).__editor.getDoc().tokens[n].value,
      name,
    );
    assert.equal(tokVal, "#0a0b0c", "token value committed");

    // --- annotations: add a note, see a pin, send to cursor ---
    await page.click('.seg button:text-is("Pages")');
    await page.evaluate(() => (window as unknown as { __editor: { select(ids: string[]): void } }).__editor.select(["fr_login"]));
    await page.waitForSelector(".note-input");
    await page.locator(".note-input").fill("Tighten the top padding");
    await page.locator(".notes .btn.sm").click();
    const annCount = await page.evaluate(() =>
      Object.values((window as unknown as { __editor: { getDoc(): { annotations?: Record<string, { nodeId: string }> } } }).__editor.getDoc().annotations ?? {}).filter((a) => a.nodeId === "fr_login").length,
    );
    assert.equal(annCount, 1, "annotation stored on fr_login");
    await page.waitForSelector("svg.overlay g.pin");
    await page.locator(".note .mini", { hasText: "Send" }).first().click();
    const sent = await page.evaluate(() => (window as unknown as { __editor: { lastSendToCursor?: string } }).__editor.lastSendToCursor);
    assert.ok(sent && sent.includes("fr_login") && sent.includes("Tighten the top padding"), "send-to-cursor carried the note");
    const status = await page.evaluate(() =>
      Object.values((window as unknown as { __editor: { getDoc(): { annotations?: Record<string, { status: string }> } } }).__editor.getDoc().annotations ?? {})[0].status,
    );
    assert.equal(status, "sent", "note marked sent after send");

    // --- snap/align: a second frame at x=480; dragging fr_login near it snaps its left edge to 480 ---
    await page.evaluate(() =>
      (window as unknown as { __editor: { applyOps(o: unknown[]): void } }).__editor.applyOps([
        { op: "createFrame", frame: { id: "fr_b", type: "frame", name: "B", x: 480, y: 0, width: 390, height: 600, children: [] }, page: "pg_sprint" },
      ]),
    );
    await page.waitForSelector('[data-node-id="fr_b"]');
    await page.evaluate(() => (window as unknown as { __editor: { select(ids: string[]): void } }).__editor.select(["fr_login"]));
    const a = (await (await page.waitForSelector('[data-node-id="fr_login"]')).boundingBox())!;
    const b = (await (await page.$('[data-node-id="fr_b"]'))!.boundingBox())!;
    const startX = a.x + 24, startY = a.y + 24;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + (b.x - a.x) - 3, startY, { steps: 6 }); // 3px short of alignment
    const guideShown = await page.$("svg.overlay line.guide"); // zero-width line → query, not waitForSelector(visible)
    assert.ok(guideShown, "a snap guide rendered during the drag");
    await page.mouse.up();
    const loginX = await page.evaluate(() => (window as unknown as { __editor: { getDoc(): { nodes: Record<string, { x?: number }> } } }).__editor.getDoc().nodes.fr_login.x);
    assert.equal(loginX, 480, "fr_login snapped its left edge to the neighbour at x=480");

    // --- 1c.1 expressiveness: a gradient + shadow + per-corner radius card renders ---
    await page.evaluate(() =>
      (window as unknown as { __editor: { applyOps(o: unknown[]): void } }).__editor.applyOps([
        { op: "create", parent: "fr_login", node: {
            id: "rc_hero", type: "rect", name: "Hero",
            fill: { kind: "linear", angle: 135, stops: [{ color: "#4F46E5", at: 0 }, { color: "#8B5CF6", at: 1 }] },
            radius: [16, 16, 0, 0],
            shadow: { x: 0, y: 8, blur: 24, spread: -4, color: "rgba(16,24,40,0.3)" },
            width: "fill", height: 120,
          } },
      ]),
    );
    const hero = await page.waitForSelector('[data-node-id="rc_hero"]');
    const css = await hero.evaluate((el) => {
      const c = getComputedStyle(el);
      return { bg: c.backgroundImage, shadow: c.boxShadow, radius: c.borderRadius };
    });
    assert.ok(css.bg.includes("linear-gradient"), `gradient fill rendered (got ${css.bg})`);
    assert.ok(css.shadow !== "none" && css.shadow.length > 0, "shadow rendered");
    assert.ok(/16px/.test(css.radius) && /0px/.test(css.radius), `per-corner radius rendered (got ${css.radius})`);

    // --- 1c.0 composition: clipped absolute card with image fill + scrim + title ---
    await page.evaluate(() =>
      (window as unknown as { __editor: { applyOps(o: unknown[]): void } }).__editor.applyOps([
        {
          op: "createFrame",
          page: "pg_sprint",
          frame: {
            id: "fr_card",
            type: "frame",
            name: "Cinematic",
            x: 900,
            y: 0,
            width: 320,
            height: 400,
            clip: true,
            radius: 20,
            layout: { mode: "absolute", direction: "column" },
            fill: { kind: "image", src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Crect fill='%232DD4A8' width='8' height='8'/%3E%3C/svg%3E", fit: "cover" },
            children: [],
          },
        },
        {
          op: "create",
          parent: "fr_card",
          node: {
            id: "rc_scrim",
            type: "rect",
            x: 0,
            y: 0,
            width: "fill",
            height: "fill",
            zIndex: 1,
            fill: { kind: "linear", angle: 180, stops: [{ color: "rgba(0,0,0,0)", at: 0.3 }, { color: "rgba(0,0,0,0.8)", at: 1 }] },
          },
        },
        {
          op: "create",
          parent: "fr_card",
          node: {
            id: "tx_card",
            type: "text",
            x: 20,
            y: 320,
            width: 280,
            height: "hug",
            zIndex: 2,
            content: "On the media",
            fill: "#fff",
            font: { family: "system-ui", size: 22, weight: 700 },
          },
        },
        {
          op: "create",
          parent: "fr_login",
          node: {
            id: "fr_peek",
            type: "frame",
            width: 80,
            height: 80,
            fill: "#12302A",
            radius: 12,
            layout: { direction: "column", margin: [-20, 0, 0, 0] },
            transform: { rotate: -6, scale: 0.95 },
            children: [],
          },
        },
      ]),
    );
    const card = await page.waitForSelector('[data-node-id="fr_card"]');
    const cardCss = await card.evaluate((el) => {
      const c = getComputedStyle(el);
      return { bg: c.backgroundImage, overflow: c.overflow, position: c.position };
    });
    assert.ok(cardCss.bg.includes("url("), `image fill rendered (got ${cardCss.bg})`);
    assert.equal(cardCss.overflow, "hidden", "clip → overflow hidden");

    const scrim = await page.waitForSelector('[data-node-id="rc_scrim"]');
    const scrimCss = await scrim.evaluate((el) => {
      const c = getComputedStyle(el);
      return { position: c.position, z: c.zIndex, bg: c.backgroundImage, w: c.width, h: c.height };
    });
    assert.equal(scrimCss.position, "absolute", "absolute child is positioned");
    assert.ok(Number(scrimCss.z) >= 1, "scrim zIndex applied");
    assert.ok(scrimCss.bg.includes("linear-gradient"), "scrim gradient");

    const title = await page.waitForSelector('[data-node-id="tx_card"]');
    const titleCss = await title.evaluate((el) => {
      const c = getComputedStyle(el);
      return { position: c.position, z: c.zIndex, top: c.top, left: c.left };
    });
    assert.equal(titleCss.position, "absolute");
    assert.ok(Number(titleCss.z) >= 2);
    assert.equal(titleCss.top, "320px");
    assert.equal(titleCss.left, "20px");

    const peek = await page.waitForSelector('[data-node-id="fr_peek"]');
    const peekCss = await peek.evaluate((el) => {
      const c = getComputedStyle(el);
      return { marginTop: c.marginTop, transform: c.transform };
    });
    assert.equal(peekCss.marginTop, "-20px", "negative margin");
    assert.ok(peekCss.transform !== "none", "transform applied");

    // --- 1c.2: icon + chart + shape render as inline SVG; screenshot captures them ---
    await page.evaluate(() =>
      (window as unknown as { __editor: { applyOps(o: unknown[]): void } }).__editor.applyOps([
        {
          op: "createFrame",
          page: "pg_sprint",
          frame: {
            id: "fr_prim",
            type: "frame",
            name: "Primitives",
            x: 1280,
            y: 0,
            width: 360,
            height: 320,
            fill: "#0B1F1A",
            layout: { direction: "column", gap: 16, padding: 16, align: "stretch" },
            children: [],
          },
        },
        { op: "create", parent: "fr_prim", node: { id: "ic_home", type: "icon", name: "home", fill: "#2DD4A8", width: 28, height: 28 } },
        {
          op: "create",
          parent: "fr_prim",
          node: {
            id: "ch_bar",
            type: "chart",
            width: "fill",
            height: 160,
            chart: { kind: "bar", labels: ["A", "B", "C"], series: [{ color: "#2DD4A8", values: [3, 7, 5] }], options: { axis: true, grid: true } },
          },
        },
        { op: "create", parent: "fr_prim", node: { id: "sh_star", type: "shape", kind: "star", width: 40, height: 40, fill: "#2DD4A8" } },
      ]),
    );
    await page.waitForSelector('[data-node-id="ic_home"] svg');
    await page.waitForSelector('[data-node-id="ch_bar"] svg');
    await page.waitForSelector('[data-node-id="sh_star"] svg');
    const pathCount = await page.locator('[data-node-id="ic_home"] svg path').count();
    assert.ok(pathCount >= 1, "icon has inlined path geometry");
    const barCount = await page.locator('[data-node-id="ch_bar"] svg rect').count();
    assert.ok(barCount >= 3, `chart drew bars (got ${barCount})`);

    const primShot = await page.evaluate(() =>
      (window as unknown as { __editor: { screenshot(id: string, s: number): Promise<{ png: string; width: number; height: number }> } }).__editor.screenshot("fr_prim", 1),
    );
    assert.ok(primShot.png.length > 2000, "screenshot of SVG primitives is non-trivial");
    const primBuf = Buffer.from(primShot.png, "base64");
    assert.equal(primBuf.subarray(1, 4).toString(), "PNG");
    await fs.writeFile(path.join(here, "../.test-out/fr_prim.png"), primBuf);

    // --- 1c.4: expressiveness + widgets on sample fr_nextgen ---
    await page.waitForSelector('[data-node-id="fr_nextgen"]');
    await page.waitForSelector('[data-node-id="av_ng_a"]');
    await page.waitForSelector('[data-node-id="pr_ng_linear"]');
    await page.waitForSelector('[data-node-id="ch_ng_spark"] svg');
    await page.waitForSelector('[data-node-id="sk_ng_block"]');
    await page.waitForSelector('[data-node-id="sh_ng_blob"] svg');
    const ngTitleCss = await page.locator('[data-node-id="tx_ng_title"]').evaluate((el) => {
      const c = getComputedStyle(el);
      return { clip: c.backgroundClip || (c as CSSStyleDeclaration & { webkitBackgroundClip?: string }).webkitBackgroundClip, color: c.color };
    });
    assert.ok(String(ngTitleCss.clip).includes("text") || ngTitleCss.color === "rgba(0, 0, 0, 0)" || ngTitleCss.color === "transparent", "gradient text clips");
    const sparkPaths = await page.locator('[data-node-id="ch_ng_spark"] svg path').count();
    assert.ok(sparkPaths >= 1, "sparkline drew path");
    await page.evaluate(() =>
      (window as unknown as { __editor: { applyOps(o: unknown[]): void } }).__editor.applyOps([
        {
          op: "create",
          parent: "fr_nextgen",
          node: {
            id: "rc_blur_demo",
            type: "rect",
            name: "Blur demo",
            width: 80,
            height: 40,
            fill: "#2DD4A8",
            blur: 6,
            mixBlendMode: "screen",
            mask: { kind: "linear", stops: [{ color: "#000", at: 0 }, { color: "transparent", at: 1 }] },
          },
        },
      ]),
    );
    const blurEl = await page.waitForSelector('[data-node-id="rc_blur_demo"]');
    const blurCss = await blurEl.evaluate((el) => {
      const c = getComputedStyle(el);
      return { filter: c.filter, blend: c.mixBlendMode, mask: c.maskImage || (c as CSSStyleDeclaration & { webkitMaskImage?: string }).webkitMaskImage };
    });
    assert.ok(blurCss.filter.includes("blur"), `layer blur applied (${blurCss.filter})`);
    assert.equal(blurCss.blend, "screen");
    assert.ok(blurCss.mask && blurCss.mask !== "none", "mask applied");

    const ngShot = await page.evaluate(() =>
      (window as unknown as { __editor: { screenshot(id: string, s: number): Promise<{ png: string; width: number; height: number }> } }).__editor.screenshot("fr_nextgen", 1),
    );
    assert.ok(ngShot.png.length > 2000, "screenshot of nextgen frame is non-trivial");
    await fs.writeFile(path.join(here, "../.test-out/fr_nextgen.png"), Buffer.from(ngShot.png, "base64"));

    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
