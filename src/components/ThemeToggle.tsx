"use client";

type Theme = "dark" | "light";

function readThemeFromDom(): Theme {
  const value = document.documentElement.getAttribute("data-theme");
  return value === "light" ? "light" : "dark";
}

function writeTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem("theme", theme);
  } catch {}
}

export default function ThemeToggle() {
  return (
    <button
      type="button"
      className="themeToggle"
      onClick={() => {
        const current = readThemeFromDom();
        const next: Theme = current === "dark" ? "light" : "dark";
        writeTheme(next);
      }}
      aria-label="Toggle dark and light mode"
      title="Toggle dark and light mode"
    >
      [ View_Mode: <span className="themeToggleLabel">Invert</span> ]
    </button>
  );
}
