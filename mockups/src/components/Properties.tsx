import { useDoc } from "../board/useDoc";

type Row = { label: string; value: string; swatch?: string; num?: string; accent?: boolean };

function TokenRow({ r }: { r: Row }) {
  return (
    <div className="prop__row prop__row--stack">
      <label>{r.label}</label>
      <button type="button" className={`token-pick ${r.accent ? "is-accent" : ""}`}>
        {r.swatch && <i style={{ background: r.swatch }} />}
        {r.num && <span className="token-pick__num">{r.num}</span>}
        <span>{r.value}</span>
      </button>
    </div>
  );
}

/** Properties — node props bound to $tokens. Never a token list; the System page owns that. */
export function Properties() {
  const { doc, selection, activePageId } = useDoc();
  const page = doc.pages[activePageId];

  if (!selection) {
    return (
      <div className="prop">
        <div className="prop__row">
          <label>Page</label>
          <input readOnly value={page?.name ?? "—"} />
        </div>
        <div className="prop__row">
          <label>Frames</label>
          <input readOnly value={String(page?.frames.length ?? 0)} />
        </div>
        <p className="prop__hint">Select a frame or a node to edit its properties.</p>
      </div>
    );
  }

  if (selection.kind === "frame") {
    const fr = doc.frames[selection.id];
    return (
      <div className="prop">
        <div className="prop__row">
          <label>Name</label>
          <input readOnly value={fr.name} />
        </div>
        <div className="prop__row">
          <label>Type</label>
          <input readOnly value="frame" />
        </div>
        <div className="prop__row">
          <label>W × H</label>
          <input readOnly value={`${fr.w} × ${fr.h}`} />
        </div>
        <div className="prop__row">
          <label>Preset</label>
          <input readOnly value={fr.size === "phone" ? "phone · optional" : fr.size === "desktop" ? "desktop · optional" : "custom"} />
        </div>

        <div className="prop__section">Layout</div>
        <div className="prop__row">
          <label>Direction</label>
          <input readOnly value={fr.size === "phone" ? "column" : "column"} />
        </div>
        <TokenRow r={{ label: "Gap", value: "$space.4", num: "16" }} />
        <TokenRow r={{ label: "Padding", value: "$space.6 · $space.4", num: "24 16" }} />

        <div className="prop__section">Style</div>
        <TokenRow r={{ label: "Fill", value: fr.kind === "email" ? "$color.surface" : "$color.bg", swatch: fr.kind === "email" ? "#f7f4ee" : "#0B1F1A" }} />
        <div className="prop__row">
          <label>Stroke</label>
          <input readOnly value="none" />
        </div>
        <TokenRow r={{ label: "Radius", value: "$radius.none", num: "0" }} />

        {fr.link && (
          <>
            <div className="prop__section">Prototype</div>
            <div className="prop__row">
              <label>Link</label>
              <input readOnly value={`→ ${doc.frames[fr.link]?.name ?? fr.link} · push`} />
            </div>
          </>
        )}
        <p className="prop__hint">Raw values are an escape hatch — prefer tokens.</p>
      </div>
    );
  }

  if (selection.kind === "instance") {
    const parent = doc.frames[selection.frame];
    return (
      <div className="prop">
        <div className="prop__row">
          <label>Name</label>
          <input readOnly value={selection.name} />
        </div>
        <div className="prop__row">
          <label>Type</label>
          <input readOnly value="instance" />
        </div>
        <div className="prop__row">
          <label>Component</label>
          <input readOnly value={`${selection.component} · ${selection.variant}`} />
        </div>
        <div className="prop__row">
          <label>In</label>
          <input readOnly value={parent?.name ?? selection.frame} />
        </div>
        <div className="prop__row">
          <label>W × H</label>
          <input readOnly value={selection.component === "Button" && selection.variant === "primary" ? "fill × 48" : "hug × 32"} />
        </div>

        <div className="prop__section">Style · from component</div>
        <TokenRow r={{ label: "Fill", value: "$color.accent", swatch: "#2DD4A8", accent: true }} />
        <TokenRow r={{ label: "Radius", value: "$radius.md", num: "12" }} />
        <TokenRow r={{ label: "Text style", value: "$type.label" }} />

        <div className="prop__section">Prototype</div>
        <div className="prop__row">
          <label>Link</label>
          <input readOnly value={selection.link ? `→ ${doc.frames[selection.link]?.name ?? selection.link} · push` : "none"} />
        </div>
        <p className="prop__hint">Overrides here are per-instance; edit the component to change all.</p>
      </div>
    );
  }

  // text
  const parent = doc.frames[selection.frame];
  return (
    <div className="prop">
      <div className="prop__row">
        <label>Name</label>
        <input readOnly value={selection.name} />
      </div>
      <div className="prop__row">
        <label>Type</label>
        <input readOnly value="text" />
      </div>
      <div className="prop__row">
        <label>In</label>
        <input readOnly value={parent?.name ?? selection.frame} />
      </div>
      <div className="prop__row">
        <label>W × H</label>
        <input readOnly value="fill × hug" />
      </div>
      <div className="prop__section">Style</div>
      <TokenRow r={{ label: "Text style", value: "$type.display" }} />
      <TokenRow r={{ label: "Fill", value: "$color.text", swatch: "#E8F5F0" }} />
      <p className="prop__hint">Raw values are an escape hatch — prefer tokens.</p>
    </div>
  );
}
