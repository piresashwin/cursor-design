import type { ReactNode } from "react";
import type { Frame } from "../board/doc";

type Props = {
  frame: Frame;
  /** Render a hotspot wrapper for prototype links (play mode) */
  hotspot?: (node: ReactNode, target: string) => ReactNode;
  /** Extra node rendered inside the primary CTA (e.g. annotation pin) */
  ctaExtra?: ReactNode;
  onSelectNode?: (id: string, name: string, kind: "instance" | "text") => void;
};

/** Content templates per frame kind — all styled by Pulse $tokens, never by Draft chrome. */
export function FrameContent({ frame, hotspot, ctaExtra, onSelectNode }: Props) {
  const wrap = (node: ReactNode, target?: string) =>
    target && hotspot ? hotspot(node, target) : node;
  const pick = (id: string, name: string, kind: "instance" | "text") => (e: React.MouseEvent) => {
    if (!onSelectNode) return;
    e.stopPropagation();
    onSelectNode(id, name, kind);
  };

  switch (frame.kind) {
    case "landing":
      return (
        <div className="desk">
          <div className="desk__nav">
            <span>Pulse</span>
            <span>Product</span>
            <span>Pricing</span>
            {wrap(
              <span className="desk__nav-cta" onClick={pick("bt_nav_cta", "Start free", "instance")}>
                Start free
                {ctaExtra}
              </span>,
              frame.link,
            )}
          </div>
          <div className="desk__hero">
            <h2 onClick={pick("tx_hero", "Hero title", "text")}>Train with a system, not a spreadsheet</h2>
            <p>Landing-width frame · same $tokens as every other artboard.</p>
            <div className="desk__hero-cta">Get the app</div>
          </div>
        </div>
      );
    case "pricing":
      return (
        <div className="desk">
          <div className="desk__nav">
            <span>Pulse</span>
            <span>Product</span>
            <span>Pricing</span>
          </div>
          <div className="desk__hero">
            <h2>Simple pricing</h2>
            <p>Free · Pro · Team — all on $color.accent.</p>
          </div>
        </div>
      );
    case "login":
      return (
        <>
          <h2 onClick={pick("tx_title", "Welcome back", "text")}>Welcome back</h2>
          <p>Sign in to continue your training plan.</p>
          <div className="field">Email</div>
          <div className="field">Password</div>
          {wrap(
            <div className="cta cta--pulse" onClick={pick("bt_submit", "Sign in", "instance")}>
              Sign in
              {ctaExtra}
            </div>,
            frame.link,
          )}
        </>
      );
    case "signup":
      return (
        <>
          <h2>Create account</h2>
          <p>Start your first plan in two minutes.</p>
          <div className="field">Name</div>
          <div className="field">Email</div>
          <div className="field">Password</div>
          <div className="cta cta--pulse">Continue</div>
        </>
      );
    case "welcome":
      return (
        <>
          <p className="mail__eyebrow">Step {frame.name.endsWith("2") ? "2" : "1"} of 3</p>
          <h2>{frame.name.endsWith("2") ? "Pick your goal" : "Hi, I’m Pulse"}</h2>
          <p>Onboarding frame — same tokens, linked with push transitions.</p>
          <div style={{ flex: 1 }} />
          {wrap(<div className="cta cta--pulse">{frame.link ? "Next" : "Finish"}</div>, frame.link)}
        </>
      );
    case "email":
      return (
        <div className="mail">
          <p className="mail__eyebrow">Pulse</p>
          <h2>We saved your streak</h2>
          <p>Wide frame — email, deck, or dashboard; the agent picks size from the brief.</p>
          <div className="mail__cta">Resume training</div>
        </div>
      );
    default:
      return (
        <div className="frame-empty">
          <p>Empty frame</p>
        </div>
      );
  }
}
