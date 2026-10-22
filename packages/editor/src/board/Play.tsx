import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import {
  findLinkOnNode,
  indexParents,
  initialPlayState,
  playBack,
  playCanBack,
  playFollowLink,
  transitionClass,
  type Doc,
  type FrameNode,
  type Link,
  type PlayState,
} from "@cursor-design/core";
import { NodeView } from "./NodeView";

type Props = {
  doc: Doc;
  startFrameId: string;
  onExit: () => void;
};

const emptySel = new Set<string>();

export function Play({ doc, startFrameId, onExit }: Props) {
  const [state, setState] = useState<PlayState>(() => initialPlayState(startFrameId));
  const [lastTransition, setLastTransition] = useState<Link["transition"]>("fade");
  const parents = useMemo(() => indexParents(doc), [doc]);

  const base = doc.nodes[state.frameId] as FrameNode | undefined;
  const w = typeof base?.width === "number" ? base.width : 390;
  const h = typeof base?.height === "number" ? base.height : 844;
  const pageName = parents.framePage[state.frameId] ? doc.pages[parents.framePage[state.frameId]]?.name : undefined;

  const follow = useCallback(
    (link: Link) => {
      setLastTransition(link.transition);
      setState((s) => playFollowLink(s, link));
    },
    [],
  );

  const back = useCallback(() => setState((s) => playBack(s)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (playCanBack(state)) back();
        else onExit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, back, onExit]);

  const onPick = useCallback(
    (id: string, e: MouseEvent) => {
      e.stopPropagation();
      const link = findLinkOnNode(doc, id);
      if (link) follow(link);
    },
    [doc, follow],
  );

  if (!base) {
    return (
      <div className="play">
        <div className="play__bar">
          <button type="button" className="btn" onClick={onExit}>
            ← Board
          </button>
          <span className="play__title">Missing frame</span>
        </div>
      </div>
    );
  }

  return (
    <div className="play">
      <div className="play__bar">
        <button type="button" className="btn" onClick={onExit}>
          ← Board
        </button>
        <span className="play__title">Play</span>
        <span className="play__crumb">
          {pageName ? `${pageName} / ` : ""}
          {base.name ?? state.frameId}
          {state.overlays.length > 0 ? ` · ${state.overlays.length} overlay` : ""}
        </span>
        <span className="spacer" />
        {playCanBack(state) && (
          <button type="button" className="btn sm" onClick={back}>
            ← Back
          </button>
        )}
      </div>
      <div className="play__stage">
        <div className="play__device" style={{ width: w, height: h }}>
          <div className="play__layer play__layer--base">
            <NodeView doc={doc} id={state.frameId} topLevel originZero selected={emptySel} onPick={onPick} />
          </div>
          {state.overlays.map((oid, i) => {
            const isTop = i === state.overlays.length - 1;
            return (
              <div
                key={`${oid}-${i}`}
                className={`play__layer play__layer--overlay ${isTop ? transitionClass(lastTransition) : ""}`}
                style={{ width: w, height: h }}
              >
                <NodeView doc={doc} id={oid} topLevel originZero selected={emptySel} onPick={onPick} />
              </div>
            );
          })}
        </div>
        <p className="play__hint">Click linked controls. Overlays stack on the base; Esc / Back dismisses.</p>
      </div>
    </div>
  );
}
