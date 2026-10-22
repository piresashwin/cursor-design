import { useMemo, useState } from "react";
import { tokenUsages, type Doc, type Op, type Token } from "@cursor-design/core";

type Props = { doc: Doc; apply: (ops: Op[]) => void; onSelect: (ids: string[]) => void };

const GROUP_ORDER = ["color", "space", "radius", "type", "font"];

function groupOf(name: string, t: Token): string {
  if (t.group) return t.group;
  const seg = name.split(/[./]/)[0];
  return seg || t.type;
}

function TokenRow({ doc, name, token, apply, onSelect }: { doc: Doc; name: string; token: Token; apply: (ops: Op[]) => void; onSelect: (ids: string[]) => void }) {
  const usages = useMemo(() => tokenUsages(doc, name), [doc, name]);
  const set = (patch: Partial<Token>) => apply([{ op: "setToken", name, token: { ...token, ...patch } as Token }]);
  const isColor = token.type === "color";
  const isNum = token.type === "number";

  const [val, setVal] = useState(String(isNum ? token.value : isColor ? token.value : "value" in token ? token.value : ""));

  return (
    <div className="tok">
      {isColor && <span className="tok-sw" style={{ background: token.value }} />}
      <div className="tok-main">
        <div className="tok-name" title={name}>${name}</div>
        <div className="tok-ctl">
          {isColor && <input className="tok-color" type="color" value={/^#([0-9a-f]{6})$/i.test(token.value) ? token.value : "#000000"} onChange={(e) => set({ value: e.target.value } as Partial<Token>)} />}
          {(isColor || isNum || token.type === "string") && (
            <input
              className="tok-val"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              onBlur={() => {
                const next = isNum ? Number(val) : val;
                if (next !== (token as { value: unknown }).value) set({ value: next } as Partial<Token>);
              }}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            />
          )}
          {token.type === "font" && <span className="tok-val readonly">{token.family} {token.size}</span>}
          {token.type === "shadow" && <span className="tok-val readonly">{Array.isArray(token.value) ? `${token.value.length} shadows` : "shadow"}</span>}
        </div>
        {isColor && token.modes && Object.keys(token.modes).length > 0 && (
          <div className="tok-modes">
            {Object.entries(token.modes).map(([m, c]) => (
              <span key={m} className="tok-mode" title={`${m}: ${c}`}><i style={{ background: c }} />{m}</span>
            ))}
          </div>
        )}
      </div>
      <button className="tok-use" title={usages.length ? `Select ${usages.length} node(s) using this token` : "Unused"} disabled={!usages.length}
        onClick={() => onSelect(usages.map((u) => u.nodeId))}>
        {usages.length}
      </button>
      <button className="tok-del" title="Delete token" onClick={() => { if (confirm(`Delete $${name}?`)) apply([{ op: "setToken", name, token: null }]); }}>×</button>
    </div>
  );
}

export function TokensPanel({ doc, apply, onSelect }: Props) {
  const groups = useMemo(() => {
    const g: Record<string, [string, Token][]> = {};
    for (const [name, t] of Object.entries(doc.tokens)) (g[groupOf(name, t)] ??= []).push([name, t]);
    for (const k of Object.keys(g)) g[k].sort((a, b) => a[0].localeCompare(b[0]));
    const keys = Object.keys(g).sort((a, b) => {
      const ia = GROUP_ORDER.indexOf(a), ib = GROUP_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
    });
    return keys.map((k) => [k, g[k]] as const);
  }, [doc.tokens]);

  const addToken = () => {
    const name = prompt("Token name (e.g. color.brand or space.4)");
    if (!name) return;
    if (doc.tokens[name]) return alert(`$${name} already exists`);
    const kind = name.split(/[./]/)[0];
    const token: Token =
      kind === "space" || kind === "radius" || kind === "size" ? { type: "number", value: 8 } : { type: "color", value: "#6366F1" };
    apply([{ op: "setToken", name, token }]);
  };

  return (
    <aside className="panel left tokens">
      <div className="panel-head">
        <span>Tokens</span>
        <button className="mini" title="New token" onClick={addToken}>+ Token</button>
      </div>
      <div className="tree">
        {groups.length === 0 && <p className="hint">No tokens yet. Add one, or ask Cursor to set up a palette.</p>}
        {groups.map(([g, items]) => (
          <div key={g} className="tok-group">
            <div className="tok-group-head">{g} <span>{items.length}</span></div>
            {items.map(([name, t]) => (
              <TokenRow key={name} doc={doc} name={name} token={t} apply={apply} onSelect={onSelect} />
            ))}
          </div>
        ))}
      </div>
      <p className="hint">Reference anywhere as $name · modes shown as chips</p>
    </aside>
  );
}
