# Components & instances

Reuse structure with a **master frame** + **instances**. Prefer this over copy-pasting buttons/rows.

## Model

| Piece | Where | Role |
|---|---|---|
| Master | `nodes[root]` (detached frame + kids) | Source of truth for layout/chrome |
| Definition | `components[id]` | Props, binds, variants |
| Instance | `nodes[id]` type `instance` | Placement + prop values + optional overrides |

Instances **expand at render** — editing the master updates every instance. Instance shell props (`width`, `height`, `link`, …) apply to the expanded root.

## Create

1. Build a normal frame (button, list row, chip) with real tokens.
2. Promote:
   ```
   design_components { action:"create", name:"Button", root:"fr_btn_master",
     component:{ props:{ label:{ type:"string", default:"Button", bind:"tx_label.content" },
                  variant:{ type:"enum", values:["primary","ghost"], default:"primary" } },
               variants:{ primary:{ "":{ fill:"$color.accent" } },
                          ghost:{ "":{ fill:"transparent", stroke:{ color:"$color.muted", width:1 } } } } } }
   ```
   Or ops: `createComponent` / `setComponent`.
3. Instantiate:
   ```
   design_components { action:"instantiate", id:"cp_button", parent:"fr_login",
     props:{ label:"Sign in", variant:"primary" }, width:"fill", height:48 }
   ```
   Or `design_apply` `create` with `type:"instance", component:"cp_…"`.

## Props & variants

- `bind`: `"tx_label.content"` (or `"tx_label"` → `.content`) writes the prop onto the master node when expanding.
- `variants[name][masterNodeId]`: shallow overrides. Use `""` or `"root"` for the component root.
- `variantProp` defaults to `"variant"`.

## Restyle without rebuild

Change master fill/radius/type once. Or update instance `props` / `overrides` (`overrides` keyed by master node id). Don’t duplicate the tree.

## Rules

- Delete instances before deleting a component (`setComponent` null / `action:"delete"`).
- Don’t delete the master root while the component exists.
- Masters are not page artboards (createComponent detaches them).
- Keep density/emphasis as variants (`primary` / `ghost` / `compact`), not separate components, when structure matches.
