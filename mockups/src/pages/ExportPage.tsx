import { Link } from "react-router-dom";

export function ExportPage() {
  return (
    <div className="page ship">
      <div className="ship__card">
        <p className="welcome__kicker">Step 05 · Ship</p>
        <h1>Theme + screens landed</h1>
        <p className="ship__lead">
          The design climax is the system in the repo — not a code dump. Pulse
          tokens and two screens are ready for the real app.
        </p>

        <ul className="ship__files">
          <li>
            <span className="ship__check" />
            <div>
              <strong>src/theme/tokens.css</strong>
              <span>5 color roles · space · type · radius</span>
            </div>
          </li>
          <li>
            <span className="ship__check" />
            <div>
              <strong>src/screens/LoginScreen.tsx</strong>
              <span>Uses $color.accent · $space.4 · $type.display</span>
            </div>
          </li>
          <li>
            <span className="ship__check" />
            <div>
              <strong>src/screens/HomeScreen.tsx</strong>
              <span>Linked from Login · prototype push</span>
            </div>
          </li>
        </ul>

        <details className="ship__code">
          <summary>View generated code</summary>
          <pre>{`export function LoginScreen() {
  return (
    <main className="bg-bg text-text flex min-h-screen flex-col gap-4 px-5 pt-12">
      <h1 className="font-display text-3xl">Welcome back</h1>
      <Button variant="primary">Sign in</Button>
    </main>
  );
}`}</pre>
        </details>

        <div className="welcome__actions">
          <Link className="btn btn--primary" to="/">
            Restart journey
          </Link>
          <Link className="btn btn--ghost" to="/board">
            Back to board
          </Link>
        </div>
      </div>
    </div>
  );
}
