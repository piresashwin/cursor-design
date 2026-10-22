import { useState } from "react";
import { Link } from "react-router-dom";

export function SystemExportPage() {
  const [format, setFormat] = useState<"css-vars" | "tailwind-v4">("css-vars");
  const [done, setDone] = useState(false);

  return (
    <div className="page system">
      <header className="system__hero">
        <div>
          <p className="welcome__kicker">WF15 · Export theme</p>
          <h1>Write theme to the repo</h1>
          <p className="system__lead">
            Design climax starts here — screens ship with the same tokens. Preview
            the diff, then confirm.
          </p>
        </div>
      </header>

      {!done ? (
        <div className="system__card system__card--wide">
          <div className="import-modes">
            <button
              type="button"
              className={`chip ${format === "css-vars" ? "is-on" : ""}`}
              onClick={() => setFormat("css-vars")}
            >
              css-vars · tokens.css
            </button>
            <button
              type="button"
              className={`chip ${format === "tailwind-v4" ? "is-on" : ""}`}
              onClick={() => setFormat("tailwind-v4")}
            >
              tailwind-v4 · @theme
            </button>
          </div>

          <div className="export__path" style={{ marginBottom: 12 }}>
            {format === "css-vars"
              ? "src/theme/tokens.css"
              : "src/theme/theme.css (@theme)"}
          </div>

          <pre className="anno-panel__prompt" style={{ marginBottom: 16 }}>
            {format === "css-vars"
              ? `:root {
  --color-bg: #0B1F1A;
  --color-text: #E8F5F0;
  --color-accent: #2DD4A8;
  --space-4: 16px;
}`
              : `@theme {
  --color-bg: #0B1F1A;
  --color-accent: #2DD4A8;
  --spacing-4: 16px;
}`}
          </pre>

          <div className="welcome__actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setDone(true)}
            >
              Confirm write
            </button>
            <Link className="btn btn--ghost" to="/system/workspace">
              Back
            </Link>
          </div>
        </div>
      ) : (
        <div className="system__card system__card--wide">
          <h2>Theme written</h2>
          <ul className="ship__files">
            <li>
              <span className="ship__check" />
              <div>
                <strong>
                  {format === "css-vars"
                    ? "src/theme/tokens.css"
                    : "src/theme/theme.css"}
                </strong>
                <span>5 color roles · space · type</span>
              </div>
            </li>
          </ul>
          <div className="welcome__actions">
            <Link className="btn btn--primary" to="/ship">
              Continue · Ship screens
            </Link>
            <Link className="btn btn--ghost" to="/system/workspace">
              Back to System
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
