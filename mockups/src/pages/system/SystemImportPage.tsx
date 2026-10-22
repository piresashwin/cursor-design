import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const preview = [
  { name: "color.primary", mapped: "color.accent", status: "map" },
  { name: "color.background", mapped: "color.bg", status: "map" },
  { name: "spacing.4", mapped: "space.4", status: "map" },
  { name: "fontFamily.sans", mapped: "—", status: "skip" },
];

export function SystemImportPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"merge" | "replace">("merge");

  return (
    <div className="page system">
      <header className="system__hero">
        <div>
          <p className="welcome__kicker">WF3 · Import from Tailwind</p>
          <h1>Preview import</h1>
          <p className="system__lead">
            Found <code>tailwind.config.ts</code>. Confirm mapping before writing
            tokens into the design file.
          </p>
        </div>
      </header>

      <div className="system__card system__card--wide">
        <div className="import-modes">
          <button
            type="button"
            className={`chip ${mode === "merge" ? "is-on" : ""}`}
            onClick={() => setMode("merge")}
          >
            Merge (keep doc on conflict)
          </button>
          <button
            type="button"
            className={`chip ${mode === "replace" ? "is-on" : ""}`}
            onClick={() => setMode("replace")}
          >
            Replace all
          </button>
        </div>

        <table className="import-table">
          <thead>
            <tr>
              <th>Source</th>
              <th>Token</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {preview.map((r) => (
              <tr key={r.name}>
                <td>
                  <code>{r.name}</code>
                </td>
                <td>
                  <code>{r.mapped}</code>
                </td>
                <td>
                  <span className={`tag tag--${r.status}`}>
                    {r.status === "map" ? "Will import" : "Skipped"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="welcome__actions">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => nav("/system/workspace?seed=pulse&from=import")}
          >
            Confirm {mode}
          </button>
          <Link className="btn btn--ghost" to="/system">
            Back
          </Link>
        </div>
      </div>
    </div>
  );
}
