import { Link } from "react-router-dom";

export function EmptyPage() {
  return (
    <div className="page welcome">
      <div className="welcome__stage">
        <div className="welcome__brand">
          <h1 className="welcome__mark">Draft</h1>
          <p className="welcome__tag">
            Design system and screens, beside your code. The Cursor agent builds
            with your tokens — you refine on the board.
          </p>
        </div>
        <div className="welcome__side">
          <p className="welcome__kicker">First 10 minutes</p>
          <h2 className="welcome__title">Start with the system, then the screens</h2>
          <ol className="welcome__journey">
            <li>
              <strong>System</strong> — seed tokens for Pulse fitness
            </li>
            <li>
              <strong>Board</strong> — agent lays out any artboards from the brief
            </li>
            <li>
              <strong>Review</strong> — annotate, one Send to Cursor
            </li>
            <li>
              <strong>Ship</strong> — theme + screens land in the repo
            </li>
          </ol>
          <div className="welcome__actions">
            <Link className="btn btn--primary" to="/system">
              Begin · seed tokens
            </Link>
            <Link className="btn btn--ghost" to="/board">
              Skip to board
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
