import { useEffect, useState } from "react";
import type { Doc, Op, Node, Annotation } from "@cursor-design/core";

type Props = { doc: Doc; selection: string[]; apply: (ops: Op[]) => void; onSend: (text: string) => void };

function Field({ label, value, onCommit, type = "text" }: { label: string; value: string; onCommit: (v: string) => void; type?: string }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== value && onCommit(v)} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
    </label>
  );
}

const sizeParse = (s: string): number | "fill" | "hug" => (s === "fill" || s === "hug" ? s : Number(s) || 0);
const numOrRef = (s: string): number | string => (s.startsWith("$") ? s : Number(s) || 0);
const padParse = (s: string): number | string | (number | string)[] => {
  const parts = s.trim().split(/\s+/).filter(Boolean).map(numOrRef);
  if (parts.length <= 1) return parts[0] ?? 0;
  return parts.length === 2 || parts.length === 4 ? parts : [parts[0], parts[1]];
};
const padShow = (p: unknown): string => (Array.isArray(p) ? p.map(String).join(" ") : p === undefined || p === null ? "" : String(p));
const radiusParse = (s: string): number | string | (number | string)[] => {
  const p = s.trim().split(/\s+/).filter(Boolean).map(numOrRef);
  return p.length === 4 ? p : p[0] ?? 0;
};

// A text field paired with a dropdown of tokens of a given type.
function TokenPick({ label, value, tokens, onCommit }: { label: string; value: string; tokens: string[]; onCommit: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <label className="field">
      <span>{label}</span>
      <span className="tokfield">
        <input value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== value && onCommit(v)} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
        {tokens.length > 0 && (
          <select value="" title="Use a token" onChange={(e) => { if (e.target.value) { setV(e.target.value); onCommit(e.target.value); } }}>
            <option value="">$</option>
            {tokens.map((t) => <option key={t} value={`$${t}`}>{t}</option>)}
          </select>
        )}
      </span>
    </label>
  );
}

function Comments({ doc, node, apply, onSend }: { doc: Doc; node: Node; apply: (ops: Op[]) => void; onSend: (text: string) => void }) {
  const [draft, setDraft] = useState("");
  const entries = Object.entries(doc.annotations ?? {}).filter(([, a]) => a.nodeId === node.id);
  const label = node.name ?? node.type;

  const add = () => {
    const body = draft.trim();
    if (!body) return;
    apply([{ op: "upsertAnnotation", annotation: { nodeId: node.id, body, status: "open" } as Annotation }]);
    setDraft("");
  };
  const send = (id: string, a: Annotation) => {
    onSend(`In the open design file, address this note on ${label} (${node.id}): "${a.body}"`);
    apply([{ op: "upsertAnnotation", id, annotation: { ...a, status: "sent" } }]);
  };

  return (
    <>
      <div className="section">Comments{entries.length ? ` (${entries.length})` : ""}</div>
      <div className="notes">
        {entries.map(([id, a]) => (
          <div key={id} className={`note note--${a.status}`}>
            <p className="note-body">{a.body}</p>
            <div className="note-row">
              <span className={`note-status ${a.status}`}>{a.status}</span>
              <span className="spacer" />
              <button className="mini" title="Prefill Cursor with this note" onClick={() => send(id, a)}>Send</button>
              {a.status !== "resolved" && <button className="mini" title="Mark resolved" onClick={() => apply([{ op: "upsertAnnotation", id, annotation: { ...a, status: "resolved" } }])}>Resolve</button>}
              <button className="mini" title="Delete" onClick={() => apply([{ op: "deleteAnnotation", ids: [id] }])}>×</button>
            </div>
          </div>
        ))}
        <textarea className="note-input" placeholder="Add a note for Cursor…" value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); add(); } }} />
        <button className="btn sm" disabled={!draft.trim()} onClick={add}>Add note</button>
      </div>
    </>
  );
}

export function Properties({ doc, selection, apply, onSend }: Props) {
  const id = selection[0];
  const n = id ? (doc.nodes[id] as Node | undefined) : undefined;
  const set = (patch: Record<string, unknown>) => n && apply([{ op: "update", id: n.id, set: patch }]);
  const tokensOf = (type: string) => Object.entries(doc.tokens).filter(([, t]) => t.type === type).map(([k]) => k);
  const colorTokens = tokensOf("color");

  return (
    <aside className="panel right">
      <div className="panel-head">Properties</div>
      {!n ? (
        <p className="hint">Select a frame or node. {selection.length > 1 ? `${selection.length} selected.` : ""}</p>
      ) : (
        <div className="props">
          <Field label="Name" value={n.name ?? ""} onCommit={(v) => set({ name: v })} />
          <div className="field"><span>Type</span><input readOnly value={n.type} /></div>
          <div className="field"><span>Id</span><input readOnly value={n.id} /></div>
          {(n.x !== undefined || n.y !== undefined) && (
            <div className="row2">
              <Field label="X" value={String(n.x ?? 0)} onCommit={(v) => set({ x: Number(v) })} />
              <Field label="Y" value={String(n.y ?? 0)} onCommit={(v) => set({ y: Number(v) })} />
            </div>
          )}
          <div className="row2">
            <Field label="W" value={String(n.width ?? "hug")} onCommit={(v) => set({ width: sizeParse(v) })} />
            <Field label="H" value={String(n.height ?? "hug")} onCommit={(v) => set({ height: sizeParse(v) })} />
          </div>
          {n.type === "frame" && n.layout && (
            <>
              <div className="section">Layout</div>
              <div className="field"><span>Mode</span>
                <select value={n.layout.mode ?? "flex"} onChange={(e) => set({ layout: { ...n.layout, mode: e.target.value === "flex" ? undefined : e.target.value } })}>
                  <option value="flex">flex</option><option value="absolute">absolute</option>
                </select>
              </div>
              {(n.layout.mode ?? "flex") === "flex" && (
                <>
                  <div className="field"><span>Direction</span>
                    <select value={n.layout.direction} onChange={(e) => set({ layout: { ...n.layout, direction: e.target.value } })}>
                      <option value="column">column</option><option value="row">row</option>
                    </select>
                  </div>
                  <div className="row2">
                    <div className="field"><span>Align</span>
                      <select value={n.layout.align ?? "start"} onChange={(e) => set({ layout: { ...n.layout, align: e.target.value } })}>
                        {["start", "center", "end", "stretch"].map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div className="field"><span>Justify</span>
                      <select value={n.layout.justify ?? "start"} onChange={(e) => set({ layout: { ...n.layout, justify: e.target.value } })}>
                        {["start", "center", "end", "space-between"].map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>
                  <TokenPick label="Gap" value={String(n.layout.gap ?? "")} tokens={tokensOf("number")} onCommit={(v) => set({ layout: { ...n.layout, gap: v ? numOrRef(v) : undefined } })} />
                </>
              )}
              <Field label="Padding" value={padShow(n.layout.padding)} onCommit={(v) => set({ layout: { ...n.layout, padding: v ? padParse(v) : undefined } })} />
              <Field label="Margin" value={padShow(n.layout.margin)} onCommit={(v) => set({ layout: { ...n.layout, margin: v ? padParse(v) : undefined } })} />
            </>
          )}
          <div className="section">Style</div>
          {Array.isArray(n.fill) ? (
            <div className="field"><span>Fill</span><input readOnly value={`layered (${n.fill.length})`} /></div>
          ) : typeof n.fill === "object" && n.fill !== null ? (
            <div className="field"><span>Fill</span><input readOnly value={`${(n.fill as { kind?: string }).kind ?? "paint"}`} /></div>
          ) : (
            <TokenPick label={n.type === "text" ? "Color" : "Fill"} value={typeof n.fill === "string" ? n.fill : ""} tokens={colorTokens} onCommit={(v) => (v ? set({ fill: v }) : apply([{ op: "update", id: n.id, unset: ["fill"] }]))} />
          )}
          <TokenPick label="Radius" value={padShow(n.radius)} tokens={tokensOf("number")} onCommit={(v) => (v ? set({ radius: radiusParse(v) }) : apply([{ op: "update", id: n.id, unset: ["radius"] }]))} />
          {n.shadow != null && <div className="field"><span>Shadow</span><input readOnly value={Array.isArray(n.shadow) ? `${n.shadow.length} shadows` : typeof n.shadow === "string" ? n.shadow : "1 shadow"} /></div>}
          {n.zIndex != null && <Field label="zIndex" value={String(n.zIndex)} onCommit={(v) => set({ zIndex: Number(v) })} />}
          {n.backdropBlur != null && <Field label="Backdrop blur" value={String(n.backdropBlur)} onCommit={(v) => set({ backdropBlur: numOrRef(v) })} />}
          {n.blur != null && <Field label="Blur" value={String(n.blur)} onCommit={(v) => set({ blur: numOrRef(v) })} />}
          {n.mixBlendMode != null && <div className="field"><span>Blend</span><input readOnly value={n.mixBlendMode} /></div>}
          {n.outline != null && <div className="field"><span>Outline</span><input readOnly value={`${n.outline.width}px ${n.outline.color}`} /></div>}
          {n.mask != null && <div className="field"><span>Mask</span><input readOnly value={n.mask.kind} /></div>}
          {n.clipPath != null && <div className="field"><span>Clip</span><input readOnly value={n.clipPath.kind} /></div>}
          {n.transform != null && <div className="field"><span>Transform</span><input readOnly value={[n.transform.x != null && `x:${n.transform.x}`, n.transform.y != null && `y:${n.transform.y}`, n.transform.scale != null && `s:${n.transform.scale}`, n.transform.rotate != null && `r:${n.transform.rotate}`].filter(Boolean).join(" ")} /></div>}
          {n.type === "text" && (
            <>
              <Field label="Text" value={n.content} onCommit={(v) => set({ content: v })} />
              <TokenPick label="Font" value={typeof n.font === "string" ? n.font : ""} tokens={tokensOf("font")} onCommit={(v) => set({ font: v })} />
              {n.decoration != null && <div className="field"><span>Decoration</span><input readOnly value={n.decoration} /></div>}
              {n.textTransform != null && <div className="field"><span>Transform</span><input readOnly value={n.textTransform} /></div>}
            </>
          )}
          {n.type === "avatar" && (
            <>
              {n.initials != null && <Field label="Initials" value={n.initials} onCommit={(v) => set({ initials: v })} />}
              {n.src != null && <div className="field"><span>Src</span><input readOnly value={n.src} /></div>}
            </>
          )}
          {n.type === "progress" && (
            <>
              <div className="field"><span>Kind</span><input readOnly value={n.kind} /></div>
              <Field label="Value" value={String(n.value)} onCommit={(v) => set({ value: Number(v) })} />
            </>
          )}
          {n.type === "skeleton" && <div className="field"><span>Kind</span><input readOnly value={n.kind} /></div>}
          {n.type === "instance" && (
            <>
              <div className="field">
                <span>Component</span>
                <input readOnly value={doc.components?.[n.component]?.name ?? n.component} />
              </div>
              {n.props &&
                Object.entries(n.props).map(([k, v]) => (
                  <div className="field" key={k}>
                    <span>{k}</span>
                    <input readOnly value={String(v)} />
                  </div>
                ))}
            </>
          )}
          {n.link && (
            <>
              <div className="field">
                <span>Link</span>
                <input readOnly value={`→ ${doc.nodes[n.link.to]?.name ?? n.link.to}`} />
              </div>
              <div className="field">
                <span>Present</span>
                <input readOnly value={n.link.present ?? "navigate"} />
              </div>
              {n.link.transition != null && (
                <div className="field">
                  <span>Transition</span>
                  <input readOnly value={n.link.transition} />
                </div>
              )}
            </>
          )}
          <Comments doc={doc} node={n} apply={apply} onSend={onSend} />
          <p className="hint">Use $tokens: {Object.keys(doc.tokens).slice(0, 6).join(", ")}…</p>
        </div>
      )}
    </aside>
  );
}
