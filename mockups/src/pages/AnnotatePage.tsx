import { useState } from "react";
import { Link } from "react-router-dom";
import { DocProvider } from "../board/DocContext";
import { useDoc } from "../board/useDoc";
import { EditorChrome } from "../components/EditorChrome";
import { Artboard } from "../components/Artboard";
import { FrameContent } from "../components/FrameContent";

type Stage = "compose" | "sent";

function Composer({ body, setBody, stage, setStage }: {
  body: string;
  setBody: (s: string) => void;
  stage: Stage;
  setStage: (s: Stage) => void;
}) {
  return (
    <div className="anno">
      <div className="anno-panel__head">
        <span className="anno-panel__badge">1</span>
        <div>
          <div className="anno-panel__title">Annotation</div>
          <div className="anno-panel__meta">
            on <strong>bt_nav_cta</strong> · Landing · {stage === "compose" ? "open" : "sent"}
          </div>
        </div>
      </div>

      {stage === "compose" ? (
        <>
          <label className="anno-panel__label" htmlFor="anno-body">
            Note for Cursor agent
          </label>
          <textarea
            id="anno-body"
            className="anno-panel__input"
            rows={5}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <p className="anno-panel__hint">
            One handoff for any surface the agent can draw — app, web, email, or custom.
          </p>
          <div className="anno-panel__actions">
            <button type="button" className="btn btn--primary" disabled={!body.trim()} onClick={() => setStage("sent")}>
              Send to Cursor
            </button>
            <Link className="btn btn--ghost" to="/board">
              Back
            </Link>
          </div>
        </>
      ) : (
        <>
          <div className="anno-panel__sent">
            <div className="anno-panel__sent-label">Prefilling Cursor</div>
            <pre className="anno-panel__prompt">{`Address annotation an_1 on bt_nav_cta (Landing):
"""
${body.trim()}
"""
Use existing $tokens. design_apply → design_screenshot.
Mark the annotation resolved when done.`}</pre>
          </div>
          <div className="anno-panel__actions">
            <Link className="btn btn--primary" to="/ship">
              Continue · ship
            </Link>
            <button type="button" className="btn btn--ghost" onClick={() => setStage("compose")}>
              Edit note
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ReviewBoard() {
  const { activeFrames, selection } = useDoc();
  return (
    <div className="board__world board__world--mixed">
      {activeFrames.map((fr) => (
        <Artboard
          key={fr.id}
          name={fr.name}
          size={fr.size}
          meta={`${fr.w} × ${fr.h}`}
          selected={selection?.kind === "instance" && selection.frame === fr.id}
          theme={fr.kind === "email" ? "plain" : "fitness"}
        >
          <FrameContent
            frame={fr}
            ctaExtra={
              fr.id === "fr_landing" ? (
                <span className="anno-pin" aria-hidden>
                  1
                </span>
              ) : undefined
            }
          />
        </Artboard>
      ))}
    </div>
  );
}

export function AnnotatePage() {
  const [body, setBody] = useState(
    "Hero CTA: full-width on small frames, hug content on desktop — use $space tokens.",
  );
  const [stage, setStage] = useState<Stage>("compose");

  return (
    <div className="page">
      <DocProvider
        initialPage="pg_sprint"
        initialSelection={{
          kind: "instance",
          id: "bt_nav_cta",
          name: "Start free",
          frame: "fr_landing",
          component: "Button",
          variant: "primary",
          link: "fr_login",
        }}
      >
        <EditorChrome
          rightPanelTitle="Review"
          rightPanel={<Composer body={body} setBody={setBody} stage={stage} setStage={setStage} />}
        >
          <ReviewBoard />
        </EditorChrome>
      </DocProvider>
    </div>
  );
}
