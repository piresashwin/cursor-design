export type Theme = "light" | "dark";

const KEY = "draft.theme";

export function initTheme(): Theme {
  let t: Theme | null = null;
  try {
    t = localStorage.getItem(KEY) as Theme | null;
  } catch {
    /* storage unavailable */
  }
  if (!t) t = window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.dataset.theme = t;
  return t;
}

export function setTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* ignore */
  }
}

export function currentTheme(): Theme {
  return (document.documentElement.dataset.theme as Theme) || "light";
}
