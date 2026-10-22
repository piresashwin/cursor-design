import { toPng } from "html-to-image";

/** Capture a rendered node (by data-node-id) to a base64 PNG using the DOM → SVG foreignObject path. */
export async function screenshotNode(nodeId: string, scale = 1): Promise<{ png: string; width: number; height: number }> {
  const el = document.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(nodeId)}"]`);
  if (!el) throw new Error(`node ${nodeId} is not rendered (is its page active?)`);
  const dataUrl = await toPng(el, { pixelRatio: scale, cacheBust: false, skipFonts: false });
  const png = dataUrl.replace(/^data:image\/png;base64,/, "");
  return { png, width: Math.round(el.offsetWidth * scale), height: Math.round(el.offsetHeight * scale) };
}
