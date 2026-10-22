# Overlays & motion

Compose popups from frames. Use prototype links with `present:"overlay"` for Play.

## Patterns

### Modal
- Frame same size as host (phone/desktop).
- Absolute layout; `Modal scrim` fill `rgba(…,0.5)`, `zIndex:1`, full size.
- `Modal card` centered (or bottom sheet), `zIndex:2`, radius + shadow.
- Trigger: `{ to:"fr_modal", present:"overlay", transition:"fade" }`.
- Close / scrim: `{ to:"fr_host", present:"navigate" }` (clears overlay stack when host is current).

### Drawer
- Scrim + edge panel (`x:0` or right-aligned, width ~280, `height:"fill"`).
- Trigger: `{ present:"overlay", transition:"slide-left" }` (or `slide-up` for sheets).

### Context menu / dropdown
- Small absolute panel near the control, or a dedicated overlay frame.
- Prefer `fade`. Keep copy short; one column of actions.

### Screen → screen
- Separate artboards; `{ present:"navigate", transition:"push"|"fade" }` (default present is navigate).

## Naming
`Modal scrim`, `Drawer panel`, `Menu · Share`, `Home · drawer open` (if paired static frames).

## Motion tokens
```
motion.fast: { type:"number", value:180, group:"motion" }
motion.base: { type:"number", value:240, group:"motion" }
```
Play enter classes map from `link.transition`. Prefer opacity + transform; avoid bounce/long timelines.

## Don’t
- Invent `drawer` / `modal` / `menu` / `tooltip` node types.
- Duplicate the whole app chrome inside every overlay unless the overlay is a full takeover.
- Stack three marketing callouts on the scrim.
