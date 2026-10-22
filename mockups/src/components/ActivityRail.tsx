import { Link } from "react-router-dom";

type Props = { live?: boolean; status?: string; open?: boolean };

const idle = [{ status: "idle" as const, name: "Waiting", detail: "Pin a note or select a node, then Send to Cursor" }];

const live = [
  { status: "done" as const, name: "design_tokens", detail: "12 tokens · color, space, type" },
  { status: "done" as const, name: "design_apply", detail: "3 frames · Sprint 12" },
  { status: "running" as const, name: "design_screenshot", detail: "fr_login" },
];

/** Activity log only — events come from the in-process MCP server. Not a chat. */
export function ActivityRail({ live: isLive, status, open = true }: Props) {
  const rows = isLive ? live : idle;

  return (
    <aside className={`activity ${open ? "is-open" : ""}`} aria-label="Agent activity">
      <div className="activity__head">
        <div>
          <div className="activity__title">Activity</div>
          <div className="activity__sub">
            {isLive ? (
              <>
                <i className="activity__dot" /> {status ?? "MCP tools"}
              </>
            ) : (
              "Mirrors Cursor agent · no embedded chat"
            )}
          </div>
        </div>
      </div>
      <div className="activity__list">
        {rows.map((r, i) => (
          <div key={i} className={`activity__row activity__row--${r.status}`}>
            <span className="activity__name">{r.name}</span>
            <span className="activity__detail">{r.detail}</span>
          </div>
        ))}
      </div>
      <div className="activity__foot">
        <p>
          One handoff: annotations & selection use <strong>Send to Cursor</strong>.
        </p>
        <Link className="btn btn--quiet" to="/review">
          Open review
        </Link>
      </div>
    </aside>
  );
}
