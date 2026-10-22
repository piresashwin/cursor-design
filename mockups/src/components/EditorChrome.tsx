import { Link } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";
import { ActivityRail } from "./ActivityRail";
import { PagesTree } from "./PagesTree";
import { Properties } from "./Properties";
import { useDoc } from "../board/useDoc";

type Props = {
  children: ReactNode;
  agentLive?: boolean;
  showActivity?: boolean;
  /** Replaces the Properties panel (e.g. the annotation composer) */
  rightPanel?: ReactNode;
  rightPanelTitle?: string;
  /** Status line shown in the activity rail head while the agent works */
  agentStatus?: string;
};

const NARROW = "(max-width: 1100px)";

/**
 * Editor shell. Lives inside a Cursor editor group (often 800–1000 px wide):
 * side panels become overlay drawers below 1100 px; the board is always visible.
 */
export function EditorChrome({ children, agentLive, showActivity, rightPanel, rightPanelTitle, agentStatus }: Props) {
  const { doc, activePageId } = useDoc();
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW).matches);
  const [leftOpen, setLeftOpen] = useState(() => !window.matchMedia(NARROW).matches);
  const [rightOpen, setRightOpen] = useState(() => !window.matchMedia(NARROW).matches);

  useEffect(() => {
    const mq = window.matchMedia(NARROW);
    const on = (e: MediaQueryListEvent) => {
      setNarrow(e.matches);
      setLeftOpen(!e.matches);
      setRightOpen(!e.matches);
    };
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const page = doc.pages[activePageId];
  const wsClass = [
    "workspace",
    narrow ? "workspace--narrow" : "",
    leftOpen ? "workspace--left" : "",
    rightOpen ? "workspace--right" : "",
    showActivity ? "workspace--agent" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="editor editor--quiet">
      <header className="toolbar toolbar--quiet">
        <button
          type="button"
          className={`tool tool--toggle ${leftOpen ? "active" : ""}`}
          title="Pages"
          aria-pressed={leftOpen}
          onClick={() => setLeftOpen((v) => !v)}
        >
          ☰
        </button>
        <div className="toolbar__brand">Draft</div>
        <div className="toolbar__file">
          app.design.json <span className="toolbar__crumb">/ {page?.name ?? "—"}</span>
        </div>
        <div className="toolbar__spacer" />
        <div className="toolbar__tools" role="toolbar" aria-label="Tools">
          <button className="tool active" type="button" title="Select">
            V
          </button>
          <button className="tool" type="button" title="Frame">
            F
          </button>
          <button className="tool" type="button" title="Text">
            T
          </button>
          <Link className="tool" to="/review" title="Annotate">
            ✎
          </Link>
        </div>
        <div className="toolbar__spacer" />
        <div className="toolbar__actions">
          {agentLive && (
            <span className="pill pill--live">
              <i /> Agent
            </span>
          )}
          <Link className="btn btn--quiet" to="/system/workspace">
            System
          </Link>
          <Link className="btn btn--quiet" to="/play">
            Play
          </Link>
          <Link className="btn btn--primary" to="/ship">
            Ship
          </Link>
          <button
            type="button"
            className={`tool tool--toggle ${rightOpen ? "active" : ""}`}
            title={showActivity ? "Activity" : rightPanelTitle ?? "Properties"}
            aria-pressed={rightOpen}
            onClick={() => setRightOpen((v) => !v)}
          >
            ◫
          </button>
        </div>
      </header>

      <div className={wsClass}>
        <aside className={`panel panel--left panel--quiet ${leftOpen ? "is-open" : ""}`} aria-label="Pages">
          <PagesTree />
        </aside>

        <main className="board board--quiet" onClick={narrow ? () => { setLeftOpen(false); setRightOpen(false); } : undefined}>
          {children}
        </main>

        {showActivity ? (
          <ActivityRail live={agentLive} status={agentStatus} open={rightOpen} />
        ) : (
          <aside className={`panel panel--right panel--quiet ${rightOpen ? "is-open" : ""}`} aria-label={rightPanelTitle ?? "Properties"}>
            <div className="panel__head">{rightPanelTitle ?? "Properties"}</div>
            {rightPanel ?? <Properties />}
          </aside>
        )}
      </div>
    </div>
  );
}
