import { useState } from "react";
import { Link } from "react-router-dom";
import { Artboard } from "../components/Artboard";
import { FrameContent } from "../components/FrameContent";
import { indexParents, seedDoc } from "../board/doc";

/** Play mode — follows prototype links; links may cross pages. */
export function PlayPage() {
  const [frameId, setFrameId] = useState("fr_landing");
  const [trail, setTrail] = useState<string[]>([]);
  const frame = seedDoc.frames[frameId];
  const { framePage } = indexParents(seedDoc);
  const pageName = seedDoc.pages[framePage[frameId]]?.name;

  return (
    <div className="page play">
      <div className="play__stage">
        <div className="play__chrome">
          <Link className="btn btn--ghost" to="/board">
            ← Board
          </Link>
          <div className="play__title">Play</div>
          <span className="pill">
            {pageName} / {frame.name}
          </span>
          {trail.length > 0 && (
            <button
              type="button"
              className="btn btn--quiet"
              onClick={() => {
                const prev = trail[trail.length - 1];
                setTrail((t) => t.slice(0, -1));
                setFrameId(prev);
              }}
            >
              ← Back
            </button>
          )}
        </div>

        <div className="play__artboard">
          <Artboard name={frame.name} size={frame.size} meta={`${frame.w} × ${frame.h}`}>
            <FrameContent
              frame={frame}
              hotspot={(node, target) => (
                <button
                  type="button"
                  className="hotspot"
                  onClick={() => {
                    setTrail((t) => [...t, frameId]);
                    setFrameId(target);
                  }}
                >
                  {node}
                </button>
              )}
            />
          </Artboard>
        </div>
        <p className="play__hint">Links cross pages: Landing (Sprint 12) → Login → Welcome 1 (Onboarding).</p>
      </div>
    </div>
  );
}
