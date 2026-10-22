import { Link } from "react-router-dom";
import { DocProvider } from "../board/DocContext";
import { useDoc } from "../board/useDoc";
import { EditorChrome } from "../components/EditorChrome";
import { Artboard } from "../components/Artboard";
import { FrameContent } from "../components/FrameContent";

type Mode = "board" | "live";

const PROMPT = `Build Login + Home for Pulse on the Sprint 12 page using our tokens.
Keep the landing + winback frames. Screenshot when done.`;

function Board({ live }: { live: boolean }) {
  const { doc, activeFrames, activePageId, selection, select } = useDoc();
  const page = doc.pages[activePageId];

  return (
    <div
      className="board__world board__world--mixed"
      onClick={() => select(null)}
    >
      {activeFrames.length === 0 && (
        <div className="board__empty">
          <h3>{page?.name} is empty</h3>
          <p>Ask Cursor to build a frame here, or press F to draw one.</p>
        </div>
      )}

      {activeFrames.map((fr) => (
        <Artboard
          key={fr.id}
          name={fr.name}
          size={fr.size}
          meta={`${fr.w} × ${fr.h}`}
          selected={selection?.kind === "frame" && selection.id === fr.id}
          appearing={live}
          theme={fr.kind === "email" ? "plain" : "fitness"}
          onSelect={() => select({ kind: "frame", id: fr.id })}
        >
          <FrameContent
            frame={fr}
            onSelectNode={(id, name, kind) =>
              select(
                kind === "instance"
                  ? { kind, id, name, frame: fr.id, component: "Button", variant: "primary", link: fr.link }
                  : { kind, id, name, frame: fr.id },
              )
            }
          />
        </Artboard>
      ))}

      {!live ? (
        <div className="board__dock board__dock--prompt" onClick={(e) => e.stopPropagation()}>
          <div className="board__dock-body">
            <div className="board__dock-meta">In Cursor chat · the product’s primary input</div>
            <pre className="board__dock-prompt">{PROMPT}</pre>
          </div>
          <Link className="btn btn--primary" to="/board/live">
            Simulate agent build
          </Link>
        </div>
      ) : (
        <div className="board__dock board__dock--next" onClick={(e) => e.stopPropagation()}>
          <div className="board__dock-body">
            <div className="board__dock-meta">Next</div>
            Annotate any frame — one Send to Cursor
          </div>
          <Link className="btn btn--primary" to="/review">
            Continue · review
          </Link>
        </div>
      )}
    </div>
  );
}

export function EditorPage({ mode = "board" }: { mode?: Mode }) {
  const live = mode === "live";
  return (
    <div className="page">
      <DocProvider initialPage="pg_sprint" initialSelection={{ kind: "frame", id: "fr_landing" }}>
        <EditorChrome
          agentLive={live}
          showActivity={live}
          agentStatus={live ? "Laying out frames from Pulse tokens · any size" : undefined}
        >
          <Board live={live} />
        </EditorChrome>
      </DocProvider>
    </div>
  );
}
