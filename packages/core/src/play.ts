import type { Doc, Id, Link } from "./types";
import { indexParents } from "./ops";

/** Runtime play stack: base frame + optional overlay frames on top. */
export type PlayState = {
  frameId: Id;
  overlays: Id[];
  trail: Array<{ frameId: Id; overlays: Id[] }>;
};

export function initialPlayState(frameId: Id): PlayState {
  return { frameId, overlays: [], trail: [] };
}

/** Walk from `nodeId` up to a root looking for the nearest `link`. */
export function findLinkOnNode(doc: Doc, nodeId: Id): Link | undefined {
  const { nodeParent } = indexParents(doc);
  let cur: string | undefined = nodeId;
  while (cur) {
    const link = doc.nodes[cur]?.link;
    if (link?.to && doc.nodes[link.to]) return link;
    cur = nodeParent[cur];
  }
  return undefined;
}

export function playFollowLink(state: PlayState, link: Link): PlayState {
  const present = link.present ?? "navigate";
  if (present === "overlay") {
    if (state.overlays[state.overlays.length - 1] === link.to) return state;
    return { ...state, overlays: [...state.overlays, link.to] };
  }
  // Dismiss: navigate to the current base while overlays are open → clear stack, no trail entry.
  if (link.to === state.frameId && state.overlays.length > 0) {
    return { ...state, overlays: [] };
  }
  return {
    frameId: link.to,
    overlays: [],
    trail: [...state.trail, { frameId: state.frameId, overlays: state.overlays }],
  };
}

/** Pop overlay first; otherwise restore previous navigate entry. */
export function playBack(state: PlayState): PlayState {
  if (state.overlays.length > 0) {
    return { ...state, overlays: state.overlays.slice(0, -1) };
  }
  const prev = state.trail[state.trail.length - 1];
  if (!prev) return state;
  return {
    frameId: prev.frameId,
    overlays: prev.overlays,
    trail: state.trail.slice(0, -1),
  };
}

export function playCanBack(state: PlayState): boolean {
  return state.overlays.length > 0 || state.trail.length > 0;
}

/** CSS class suffix for overlay enter animation from link.transition. */
export function transitionClass(transition: Link["transition"] | undefined): string {
  switch (transition) {
    case "slide-up":
      return "play-enter--slide-up";
    case "slide-down":
      return "play-enter--slide-down";
    case "slide-left":
      return "play-enter--slide-left";
    case "slide-right":
      return "play-enter--slide-right";
    case "push":
      return "play-enter--slide-left";
    case "instant":
      return "play-enter--instant";
    case "fade":
    default:
      return "play-enter--fade";
  }
}
