import { Link } from "react-router-dom";

export function NoFilePage() {
  return (
    <div className="page error-page">
      <div className="error-page__box">
        <p className="welcome__kicker">Agent · design_apply</p>
        <h1>No design file open</h1>
        <p>
          Listing and reads can use workspace files on disk. Mutations and
          screenshots need an editor tab so the DocumentStore stays live.
        </p>
        <div className="error-page__code">
          error: NO_ACTIVE_DOCUMENT — open or create a *.design.json
        </div>
        <div className="welcome__actions">
          <Link className="btn btn--primary" to="/">
            Create file
          </Link>
          <Link className="btn btn--ghost" to="/editor">
            Open app.design.json
          </Link>
        </div>
      </div>
    </div>
  );
}

export function McpErrorPage() {
  return (
    <div className="page error-page">
      <div className="error-page__box">
        <p className="welcome__kicker">Extension · MCP</p>
        <h1>Reconnect design tools</h1>
        <p>
          Cursor sometimes shows “0 tools” for extension-registered MCP servers.
          Re-register the local server — same fix as toggling the server off/on.
        </p>
        <div className="error-page__code">
          status: registered · tools: 0 · hint: reconnect
        </div>
        <div className="welcome__actions">
          <Link className="btn btn--primary" to="/editor">
            Reconnect
          </Link>
          <Link className="btn btn--ghost" to="/editor">
            Open settings
          </Link>
        </div>
      </div>
    </div>
  );
}
