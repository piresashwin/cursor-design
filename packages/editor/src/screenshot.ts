import { toPng } from "html-to-image";

/**
 * Capture a rendered node (by data-node-id) to a base64 PNG using the DOM → SVG foreignObject path.
 * Temporarily resets board camera zoom so capture is in document pixels (CSS zoom scales layout
 * metrics; camera uses zoom instead of transform so backdrop-filter keeps working).
 */
export async function screenshotNode(nodeId: string, scale = 1): Promise<{ png: string; width: number; height: number }> {
  const el = document.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(nodeId)}"]`);
  if (!el) throw new Error(`node ${nodeId} is not rendered (is its page active?)`);
  const world = document.querySelector<HTMLElement>(".world");
  const prevZoom = world?.style.zoom ?? "";
  if (world) world.style.zoom = "1";
  try {
    // layout flush after zoom reset
    void world?.offsetWidth;
    // skipFonts: remote Google Fonts stylesheets are opaque to cssRules (CORS); faces
    // already loaded in the document still paint into the foreignObject clone.
    const dataUrl = await toPng(el, { pixelRatio: scale, cacheBust: false, skipFonts: true });
    const png = dataUrl.replace(/^data:image\/png;base64,/, "");
    return { png, width: Math.round(el.offsetWidth * scale), height: Math.round(el.offsetHeight * scale) };
  } finally {
    if (world) world.style.zoom = prevZoom;
  }
}
