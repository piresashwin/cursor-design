import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { currentTheme, setTheme, type Theme } from "../theme";

const steps = [
  { to: "/", n: "01", label: "Welcome", match: (p: string) => p === "/" },
  { to: "/system", n: "02", label: "System", match: (p: string) => p === "/system" || p.startsWith("/system/") },
  { to: "/board", n: "03", label: "Board", match: (p: string) => p === "/board" || p.startsWith("/board/") },
  { to: "/review", n: "04", label: "Review", match: (p: string) => p === "/review" },
  { to: "/ship", n: "05", label: "Ship", match: (p: string) => p === "/ship" },
];

export function JourneyNav() {
  const { pathname } = useLocation();
  const [theme, setT] = useState<Theme>(() => currentTheme());

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setT(next);
  }

  return (
    <nav className="journey" aria-label="First-run journey">
      <span className="journey__brand">Draft</span>
      <ol className="journey__steps">
        {steps.map((s) => (
          <li key={s.to}>
            <NavLink
              to={s.to}
              end={s.to === "/"}
              className={`journey__step ${s.match(pathname) ? "is-active" : ""}`}
            >
              <span className="journey__n">{s.n}</span>
              {s.label}
            </NavLink>
          </li>
        ))}
      </ol>
      <span className="journey__hint">One story · mockups</span>
      <button
        type="button"
        className="journey__theme"
        onClick={toggle}
        title={theme === "dark" ? "Switch to light chrome" : "Switch to dark chrome"}
        aria-label="Toggle chrome theme"
      >
        {theme === "dark" ? "☀" : "☾"} {theme === "dark" ? "Light" : "Dark"} chrome
      </button>
    </nav>
  );
}
