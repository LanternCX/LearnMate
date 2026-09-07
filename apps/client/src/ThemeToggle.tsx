import { useEffect, useState } from "react";

type Theme = "auto" | "light" | "dark";
const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
const labels = { auto: "自动", light: "浅色", dark: "深色" };
const nextTheme: Record<Theme, Theme> = { auto: "light", light: "dark", dark: "auto" };

function readTheme(): Theme {
  try {
    const saved = localStorage.getItem("zhiya-theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // Storage may be unavailable in restricted browser contexts.
  }
  return "auto";
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme =
    theme === "auto" ? (systemTheme.matches ? "dark" : "light") : theme;
}

applyTheme(readTheme());

export default function ThemeToggle() {
  const [theme, setTheme] = useState(readTheme);
  useEffect(() => {
    const update = () => applyTheme(theme);
    update();
    systemTheme.addEventListener("change", update);
    return () => systemTheme.removeEventListener("change", update);
  }, [theme]);

  const label = `当前为${labels[theme]}主题，切换至${labels[nextTheme[theme]]}主题`;
  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={label}
      title={label}
      onClick={() => {
        const next = nextTheme[theme];
        applyTheme(next);
        setTheme(next);
        try {
          localStorage.setItem("zhiya-theme", next);
        } catch {
          // Switching still works for this page when storage is unavailable.
        }
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {theme === "auto" && <>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" stroke="none" />
        </>}
        {theme === "light" && <>
          <circle cx="12" cy="12" r="3.5" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </>}
        {theme === "dark" && <path d="M20 15.2A10 10 0 0 1 8.8 4a8 8 0 1 0 11.2 11.2Z" />}
      </svg>
    </button>
  );
}
