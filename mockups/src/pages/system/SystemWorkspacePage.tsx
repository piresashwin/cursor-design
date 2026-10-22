import { useMemo, useState, type CSSProperties } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  blankColors,
  pulseColors,
  pulseSpace,
  pulseType,
  usages,
  type ColorToken,
} from "../../system/seed";

export function SystemWorkspacePage() {
  const [params] = useSearchParams();
  const seed = params.get("seed") === "blank" ? "blank" : "pulse";
  const from = params.get("from");

  const [colors, setColors] = useState<ColorToken[]>(() =>
    seed === "blank" ? blankColors.map((c) => ({ ...c })) : pulseColors.map((c) => ({ ...c })),
  );
  const [selected, setSelected] = useState(colors[2]?.name ?? colors[0].name);
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [deleteBlock, setDeleteBlock] = useState(false);
  const [toast, setToast] = useState<string | null>(
    from === "import"
      ? "Imported 3 tokens from tailwind.config.ts"
      : from === "agent"
        ? "Agent batchSet · 5 color roles + space + type"
        : seed === "blank"
          ? "Blank seed · finish Accent before Board"
          : null,
  );

  const current = colors.find((c) => c.name === selected) ?? colors[0];
  const usageList = usages[current.name] ?? [];
  const canContinue = colors.some((c) => c.name === "color.accent" && c.value !== "#888888");

  const previewAccent = useMemo(
    () => (mode === "dark" ? current.dark : current.value),
    [current, mode],
  );

  function updateCurrent(patch: Partial<ColorToken>) {
    setColors((prev) =>
      prev.map((c) => (c.name === current.name ? { ...c, ...patch } : c)),
    );
    setToast("Token updated · open Board will re-resolve $refs");
  }

  return (
    <div className="page system">
      <header className="system__hero">
        <div>
          <p className="welcome__kicker">
            System workspace · WF6–11
            {from ? ` · via ${from}` : ""}
          </p>
          <h1>Pulse foundations</h1>
          <p className="system__lead">
            Edit roles inline. Preview stays live. Usage jumps to the Board.
            Raw hex on the Board stays an escape hatch — prefer these tokens.
          </p>
        </div>
        <div className="system__actions">
          <Link className="btn btn--ghost" to="/system/import">
            Import Tailwind
          </Link>
          <Link className="btn btn--ghost" to="/system/generate">
            Ask agent to extend
          </Link>
          <Link className="btn btn--ghost" to="/system/export">
            Export theme
          </Link>
          <Link
            className={`btn ${canContinue ? "btn--primary" : "btn--ghost"}`}
            to={canContinue ? "/board/live" : "#"}
            aria-disabled={!canContinue}
            onClick={(e) => {
              if (!canContinue) {
                e.preventDefault();
                setToast("Set Accent to a real brand color to continue");
              }
            }}
          >
            Continue · Board
          </Link>
        </div>
      </header>

      {toast && (
        <div className="system-toast" role="status">
          {toast}
          <button type="button" onClick={() => setToast(null)}>
            ✕
          </button>
        </div>
      )}

      <div className="workspace-sys">
        <section className="system__card">
          <div className="workspace-sys__head">
            <h2>Color roles</h2>
            <div className="mode-toggle" role="group" aria-label="Preview mode">
              <button
                type="button"
                className={mode === "light" ? "is-on" : ""}
                onClick={() => setMode("light")}
              >
                Light
              </button>
              <button
                type="button"
                className={mode === "dark" ? "is-on" : ""}
                onClick={() => setMode("dark")}
              >
                Dark
              </button>
            </div>
          </div>
          <ul className="role-list role-list--interactive">
            {colors.map((r) => (
              <li key={r.name}>
                <button
                  type="button"
                  className={`role-hit ${selected === r.name ? "is-selected" : ""}`}
                  onClick={() => setSelected(r.name)}
                >
                  <i
                    style={{
                      background: mode === "dark" ? r.dark : r.value,
                    }}
                  />
                  <div>
                    <div className="role-list__role">{r.role}</div>
                    <div className="role-list__token">${r.name}</div>
                  </div>
                  <div className="role-list__meta">
                    <span>{mode === "dark" ? r.dark : r.value}</span>
                    <span>
                      {r.usage} used
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>

          <h2 style={{ marginTop: 20 }}>Space & type</h2>
          <div className="system__space">
            {pulseSpace.map((s) => (
              <div key={s.name} className="system__space-row">
                <code>${s.name}</code>
                <span className="system__bar" style={{ width: s.value * 2.5 }} />
                <span>{s.value}px</span>
              </div>
            ))}
          </div>
          <div className="system__type">
            {pulseType.map((t) => (
              <div key={t.name}>
                <code>${t.name}</code>
                <p
                  className={`system__type-sample ${t.display ? "system__type-sample--display" : ""}`}
                >
                  {t.sample}
                </p>
              </div>
            ))}
          </div>
        </section>

        <aside className="system__card inspector">
          <p className="welcome__kicker">Inspector · WF7</p>
          <h2>{current.role}</h2>
          <code className="inspector__name">${current.name}</code>

          <label className="anno-panel__label">Light</label>
          <div className="inspector__color">
            <input
              type="color"
              value={current.value}
              onChange={(e) => updateCurrent({ value: e.target.value })}
            />
            <input
              type="text"
              value={current.value}
              onChange={(e) => updateCurrent({ value: e.target.value })}
            />
          </div>

          <label className="anno-panel__label">Dark</label>
          <div className="inspector__color">
            <input
              type="color"
              value={current.dark}
              onChange={(e) => updateCurrent({ dark: e.target.value })}
            />
            <input
              type="text"
              value={current.dark}
              onChange={(e) => updateCurrent({ dark: e.target.value })}
            />
          </div>

          <label className="anno-panel__label">Note</label>
          <input
            type="text"
            className="inspector__note"
            value={current.note}
            onChange={(e) => updateCurrent({ note: e.target.value })}
          />

          <div className="inspector__usage">
            <div className="workspace-sys__head">
              <h3>Where used · WF11</h3>
              <span>{usageList.length}</span>
            </div>
            {usageList.length === 0 ? (
              <p className="system__sub">
                Not used yet.{" "}
                <Link to="/board/live">Build a screen with these tokens →</Link>
              </p>
            ) : (
              <ul className="usage-list">
                {usageList.map((u) => (
                  <li key={u.node + u.prop}>
                    <Link to="/board">
                      <code>{u.node}</code> · {u.prop}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="welcome__actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                if (current.usage > 0) setDeleteBlock(true);
                else {
                  setColors((prev) => prev.filter((c) => c.name !== current.name));
                  setSelected(colors[0]?.name ?? "");
                  setToast("Token deleted");
                }
              }}
            >
              Delete…
            </button>
          </div>
        </aside>

        <section
          className="system__card system__card--preview"
          style={
            {
              "--pulse-accent":
                current.name === "color.accent" ? previewAccent : "#2DD4A8",
            } as CSSProperties
          }
        >
          <div>
            <h2>Preview strip</h2>
            <p className="system__sub">WF6 · updates as you edit</p>
          </div>
          <div className="system__preview">
            <div
              className="system__preview-btn"
              style={{
                background:
                  current.name === "color.accent" ? previewAccent : "#2DD4A8",
              }}
            >
              Sign in
            </div>
            <p>
              Button → <code>$color.accent</code>, <code>$radius.md</code>,{" "}
              <code>$type.label</code>
            </p>
          </div>
          <div className="system__mcp">
            <span>MCP</span>
            <code>design_tokens set / batchSet / exportTheme</code>
          </div>
        </section>
      </div>

      {deleteBlock && (
        <div className="modal-back" role="presentation">
          <div className="modal" role="dialog" aria-labelledby="del-title">
            <h2 id="del-title">Delete blocked · WF10</h2>
            <p>
              <code>${current.name}</code> is used on {current.usage} nodes.
              Replace refs or cancel.
            </p>
            <ul className="usage-list">
              {usageList.map((u) => (
                <li key={u.node}>
                  <code>{u.node}</code> · {u.prop}
                </li>
              ))}
            </ul>
            <div className="welcome__actions">
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setDeleteBlock(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  setDeleteBlock(false);
                  setToast("Mock: would open replace-refs flow");
                }}
              >
                Replace refs…
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
