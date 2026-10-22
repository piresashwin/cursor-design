import type { Doc, FrameNode, Id, MotionSample, Timeline, TimelineChannel, TimelineEase, TimelineKey, Transform } from "./types";

function easeFn(ease: TimelineEase | undefined, u: number): number {
  const t = Math.min(1, Math.max(0, u));
  switch (ease ?? "ease-out") {
    case "linear":
      return t;
    case "ease-in-out":
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    case "ease-out":
    default:
      return 1 - (1 - t) * (1 - t);
  }
}

function sampleKeys(keys: TimelineKey[], tNorm: number): number {
  const sorted = [...keys].sort((a, b) => a.t - b.t);
  if (sorted.length === 0) return 0;
  if (tNorm <= sorted[0].t) return sorted[0].value;
  if (tNorm >= sorted[sorted.length - 1].t) return sorted[sorted.length - 1].value;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (tNorm >= a.t && tNorm <= b.t) {
      const span = b.t - a.t || 1;
      const u = easeFn(b.ease ?? a.ease, (tNorm - a.t) / span);
      return a.value + (b.value - a.value) * u;
    }
  }
  return sorted[sorted.length - 1].value;
}

function setChannel(sample: MotionSample, channel: TimelineChannel, value: number) {
  if (channel === "opacity") {
    sample.opacity = value;
    return;
  }
  const tf: Transform = { ...(sample.transform ?? {}) };
  if (channel === "transform.x") tf.x = value;
  else if (channel === "transform.y") tf.y = value;
  else if (channel === "transform.scale") tf.scale = value;
  else if (channel === "transform.rotate") tf.rotate = value;
  sample.transform = tf;
}

/** Normalized time for a wall-clock position on a timeline (handles loop). */
export function timelineT(tl: Timeline, timeMs: number): number {
  const d = Math.max(1, tl.duration);
  if (tl.loop) {
    const m = ((timeMs % d) + d) % d;
    return m / d;
  }
  return Math.min(1, Math.max(0, timeMs / d));
}

/** Sample all tracks at `timeMs` → per-node opacity/transform overrides. */
export function sampleTimeline(tl: Timeline, timeMs: number): Record<Id, MotionSample> {
  const t = timelineT(tl, timeMs);
  const out: Record<Id, MotionSample> = {};
  for (const track of tl.tracks) {
    if (!track.keys?.length) continue;
    const value = sampleKeys(track.keys, t);
    const sample = out[track.nodeId] ?? (out[track.nodeId] = {});
    setChannel(sample, track.channel, value);
  }
  return out;
}

/** Timelines bound to a given frame id. */
export function timelinesForFrame(doc: Doc, frameId: Id): Timeline[] {
  if (!doc.timelines) return [];
  return Object.values(doc.timelines).filter((tl) => tl.frameId === frameId);
}

/** True if `nodeId` is `frameId` or a descendant under that frame. */
export function isUnderFrame(doc: Doc, frameId: Id, nodeId: Id): boolean {
  if (nodeId === frameId) return true;
  const nodeParent: Record<string, string> = {};
  for (const [id, n] of Object.entries(doc.nodes)) {
    if (n.type === "frame") for (const c of (n as FrameNode).children) nodeParent[c] = id;
  }
  let cur: string | undefined = nodeId;
  while (cur) {
    if (cur === frameId) return true;
    cur = nodeParent[cur];
  }
  return false;
}

/** Merge motion samples onto a shallow-cloned doc (for Play / preview render). */
export function applyMotionSamples(doc: Doc, samples: Record<Id, MotionSample>): Doc {
  const ids = Object.keys(samples);
  if (!ids.length) return doc;
  const nodes = { ...doc.nodes };
  for (const id of ids) {
    const n = nodes[id];
    const s = samples[id];
    if (!n || !s) continue;
    const next = { ...n } as typeof n & { opacity?: number; transform?: Transform };
    if (s.opacity !== undefined) next.opacity = s.opacity;
    if (s.transform) {
      next.transform = { ...(n as { transform?: Transform }).transform, ...s.transform };
    }
    nodes[id] = next;
  }
  return { ...doc, nodes };
}

/** Combine samples from several timelines (later timelines overwrite channel conflicts per node). */
export function mergeMotionSamples(parts: Record<Id, MotionSample>[]): Record<Id, MotionSample> {
  const out: Record<Id, MotionSample> = {};
  for (const part of parts) {
    for (const [id, s] of Object.entries(part)) {
      const cur = out[id] ?? (out[id] = {});
      if (s.opacity !== undefined) cur.opacity = s.opacity;
      if (s.transform) cur.transform = { ...cur.transform, ...s.transform };
    }
  }
  return out;
}
