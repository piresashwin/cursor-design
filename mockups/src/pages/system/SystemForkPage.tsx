import { Link } from "react-router-dom";

export function SystemForkPage() {
  return (
    <div className="page system">
      <header className="system__hero">
        <div>
          <p className="welcome__kicker">Step 02 · System · WF2</p>
          <h1>How do you want to start?</h1>
          <p className="system__lead">
            Foundations before screens. Pick a path — every control here does
            something. Tokens live in <code>app.design.json</code>.
          </p>
        </div>
        <div className="system__file">app.design.json · tokens empty</div>
      </header>

      <div className="fork-grid">
        <Link className="fork-card" to="/system/import">
          <span className="fork-card__n">WF3</span>
          <h2>Import from Tailwind</h2>
          <p>
            Scan <code>tailwind.config</code> / <code>@theme</code> and preview a
            merge into the design file.
          </p>
          <span className="fork-card__cta">Scan workspace theme →</span>
        </Link>

        <Link className="fork-card" to="/system/workspace?seed=blank">
          <span className="fork-card__n">WF4</span>
          <h2>Start blank</h2>
          <p>
            Seed semantic roles (Background, Accent, space, type) and edit values
            yourself.
          </p>
          <span className="fork-card__cta">Add color roles →</span>
        </Link>

        <Link className="fork-card fork-card--accent" to="/system/generate">
          <span className="fork-card__n">WF5</span>
          <h2>Generate with agent</h2>
          <p>
            Send a brief to Cursor. Agent runs <code>design_tokens.batchSet</code>
            — no embedded chat.
          </p>
          <span className="fork-card__cta">Compose Send to Cursor →</span>
        </Link>
      </div>
    </div>
  );
}
