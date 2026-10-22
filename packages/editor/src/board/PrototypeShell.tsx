import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import {
  applyMotionSamples,
  findLinkOnNode,
  indexParents,
  initialPlayState,
  mergeMotionSamples,
  playBack,
  playCanBack,
  playFollowLink,
  sampleTimeline,
  timelinesForFrame,
  transitionClass,
  type Doc,
  type FrameNode,
  type Link,
  type PlayState,
} from "@cursor-design/core";
import { NodeView } from "./NodeView";

const emptySel = new Set<string>();

export type PrototypeShellProps = {
  doc: Doc;
  startFrameId: string;
  /** When set, shows Exit control (editor Play). Omit in browser preview. */
  onExit?: () => void;
  /** Extra chrome after the title (e.g. preview badge). */
  trailing?: ReactNode;
};

export function PrototypeShell({ doc, startFrameId, onExit, trailing }: PrototypeShellProps) {
  const [state, setState] = useState<PlayState>(() => initialPlayState(startFrameId));
  const [lastTransition, setLastTransition] = useState<Link["transition"]>("fade");
  const [playing, setPlaying] = useState(true);
  const [timeMs, setTimeMs] = useState(0);
  const parents = useMemo(() => indexParents(doc), [doc]);
  const raf = useRef<number>(0);
  const lastTs = useRef<number>(0);

  // Keep play frame if still present after doc hot-reload; honor new startFrameId
  useEffect(() => {
    if (!doc.nodes[state.frameId] || (startFrameId && startFrameId !== state.frameId && !state.overlays.length && !state.trail.length)) {
      setState(initialPlayState(startFrameId));
    }
  }, [doc, startFrameId, state.frameId, state.overlays.length, state.trail.length]);

  const activeFrameIds = useMemo(() => [state.frameId, ...state.overlays], [state.frameId, state.overlays]);
  const activeTimelines = useMemo(
    () => activeFrameIds.flatMap((fid) => timelinesForFrame(doc, fid)),
    [doc, activeFrameIds],
  );
  const duration = useMemo(
    () => Math.max(1, ...activeTimelines.map((t) => t.duration), 1),
    [activeTimelines],
  );
  const anyLoop = activeTimelines.some((t) => t.loop);

  // Reset clock when navigating to a new frame/overlay stack
  useEffect(() => {
    setTimeMs(0);
    setPlaying(activeTimelines.length > 0);
    lastTs.current = 0;
  }, [state.frameId, state.overlays.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!playing || activeTimelines.length === 0) return;
    const tick = (now: number) => {
      if (!lastTs.current) lastTs.current = now;
      const dt = now - lastTs.current;
      lastTs.current = now;
      setTimeMs((t) => {
        const next = t + dt;
        if (!anyLoop && next >= duration) {
          setPlaying(false);
          return duration;
        }
        return anyLoop ? next % duration : Math.min(duration, next);
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, activeTimelines.length, duration, anyLoop]);

  const posedDoc = useMemo(() => {
    if (!activeTimelines.length) return doc;
    const parts = activeTimelines.map((tl) => sampleTimeline(tl, timeMs));
    return applyMotionSamples(doc, mergeMotionSamples(parts));
  }, [doc, activeTimelines, timeMs]);

  const base = posedDoc.nodes[state.frameId] as FrameNode | undefined;
  const w = typeof base?.width === "number" ? base.width : 390;
  const h = typeof base?.height === "number" ? base.height : 844;
  const pageName = parents.framePage[state.frameId] ? doc.pages[parents.framePage[state.frameId]]?.name : undefined;

  const follow = useCallback((link: Link) => {
    setLastTransition(link.transition);
    setState((s) => playFollowLink(s, link));
  }, []);

  const back = useCallback(() => setState((s) => playBack(s)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (playCanBack(state)) back();
        else onExit?.();
      }
      if (e.key === " " && activeTimelines.length) {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, back, onExit, activeTimelines.length]);

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
          {onExit && (
            <button type="button" className="btn" onClick={onExit}>
              ← Board
            </button>
          )}
          <span className="play__title">Missing frame</span>
        </div>
      </div>
    );
  }

  const pct = Math.round((timeMs / duration) * 100);

  return (
    <div className="play">
      <div className="play__bar">
        {onExit && (
          <button type="button" className="btn" onClick={onExit}>
            ← Board
          </button>
        )}
        <span className="play__title">Play</span>
        <span className="play__crumb">
          {pageName ? `${pageName} / ` : ""}
          {base.name ?? state.frameId}
          {state.overlays.length > 0 ? ` · ${state.overlays.length} overlay` : ""}
        </span>
        <span className="spacer" />
        {trailing}
        {activeTimelines.length > 0 && (
          <div className="play__timeline" title="Timeline scrubber">
            <button type="button" className="btn sm" onClick={() => setPlaying((p) => !p)}>
              {playing ? "Pause" : "Play"}
            </button>
            <input
              type="range"
              min={0}
              max={duration}
              value={Math.min(timeMs, duration)}
              onChange={(e) => {
                setPlaying(false);
                setTimeMs(Number(e.target.value));
              }}
              aria-label="Timeline"
            />
            <span className="play__time">
              {Math.round(timeMs)}ms · {pct}%
            </span>
          </div>
        )}
        {playCanBack(state) && (
          <button type="button" className="btn sm" onClick={back}>
            ← Back
          </button>
        )}
      </div>
      <div className="play__stage">
        <div className="play__device" style={{ width: w, height: h }}>
          <div className="play__layer play__layer--base">
            <NodeView doc={posedDoc} id={state.frameId} topLevel originZero playScroll selected={emptySel} onPick={onPick} />
          </div>
          {state.overlays.map((oid, i) => {
            const isTop = i === state.overlays.length - 1;
            return (
              <div
                key={`${oid}-${i}`}
                className={`play__layer play__layer--overlay ${isTop ? transitionClass(lastTransition) : ""}`}
                style={{ width: w, height: h }}
              >
                <NodeView doc={posedDoc} id={oid} topLevel originZero playScroll selected={emptySel} onPick={onPick} />
              </div>
            );
          })}
        </div>
        <p className="play__hint">
          Click linked controls. Overlays stack on the base; Esc / Back dismisses
          {activeTimelines.length ? "; Space toggles timeline" : ""}.
        </p>
      </div>
    </div>
  );
}
