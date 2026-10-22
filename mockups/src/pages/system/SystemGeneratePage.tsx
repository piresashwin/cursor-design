import { useState } from "react";
import { Link } from "react-router-dom";

export function SystemGeneratePage() {
  const [brief, setBrief] = useState(
    "Pulse fitness app — calm dark greens, sharp mint accent, athletic but soft.",
  );
  const [sent, setSent] = useState(false);

  const prompt = `Create a design system in the open app.design.json for:
"""
${brief.trim()}
"""
1) design_tokens list
2) design_tokens batchSet for color roles, space, type, radius
3) Do not create frames yet
4) Prefer semantic names ($color.bg, $color.accent, …)`;

  return (
    <div className="page system">
      <header className="system__hero">
        <div>
          <p className="welcome__kicker">WF5 · Generate with agent</p>
          <h1>Brief the agent</h1>
          <p className="system__lead">
            One handoff: <strong>Send to Cursor</strong> prefills chat. Agent
            writes tokens via MCP — Draft only mirrors the result.
          </p>
        </div>
      </header>

      <div className="system__split">
        <div className="system__card">
          <label className="anno-panel__label" htmlFor="brief">
            Brand brief
          </label>
          <textarea
            id="brief"
            className="anno-panel__input"
            rows={5}
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            disabled={sent}
          />
          {!sent ? (
            <div className="welcome__actions">
              <button
                type="button"
                className="btn btn--primary"
                disabled={!brief.trim()}
                onClick={() => setSent(true)}
              >
                Send to Cursor
              </button>
              <Link className="btn btn--ghost" to="/system">
                Back
              </Link>
            </div>
          ) : (
            <div className="welcome__actions">
              <Link
                className="btn btn--primary"
                to="/system/workspace?seed=pulse&from=agent"
              >
                Tokens arrived · review
              </Link>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setSent(false)}
              >
                Edit brief
              </button>
            </div>
          )}
        </div>

        <div className="system__card system__card--dark">
          <p className="welcome__kicker">Prompt deeplink</p>
          <pre className="tokens__code">{sent ? prompt : "Press Send to Cursor to build the prompt…"}</pre>
          {sent && (
            <p className="system__sub" style={{ color: "rgba(232,236,241,0.55)" }}>
              Status: <strong style={{ color: "#fff" }}>sent</strong> — press Send
              in Cursor chat, then return here.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
