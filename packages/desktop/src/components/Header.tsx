import { getCurrentWindow } from "@tauri-apps/api/window";
import { themes, type LayoutPreset, type Theme } from "../themes";

interface HeaderProps {
  layout: LayoutPreset;
  onLayoutChange: (layout: LayoutPreset) => void;
  themeName: string;
  onThemeChange: (name: string) => void;
  theme: Theme;
}

const LAYOUTS: { value: LayoutPreset; label: string }[] = [
  { value: 1, label: "1" },
  { value: 2, label: "1x2" },
  { value: 4, label: "2x2" },
  { value: 6, label: "2x3" },
  { value: 9, label: "3x3" },
];

const appWindow = getCurrentWindow();

export function Header({
  layout,
  onLayoutChange,
  themeName,
  onThemeChange,
  theme,
}: HeaderProps) {
  return (
    <header
      data-tauri-drag-region
      style={{ background: theme.colors.headerBg, color: theme.colors.headerFg }}
    >
      <div className="header-left">
        <span className="logo" style={{ color: theme.colors.accent }}>
          ◆
        </span>
        <span className="title">Manifold</span>
      </div>

      <div className="header-center">
        {LAYOUTS.map(({ value, label }) => (
          <button
            key={value}
            className={`layout-btn ${layout === value ? "active" : ""}`}
            onClick={() => onLayoutChange(value)}
            style={{
              color:
                layout === value
                  ? theme.colors.accent
                  : theme.colors.headerFg,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="header-right">
        <select
          className="theme-select"
          value={themeName}
          onChange={(e) => onThemeChange(e.target.value)}
          style={{
            background: theme.colors.headerBg,
            color: theme.colors.headerFg,
          }}
        >
          {Object.entries(themes).map(([key, t]) => (
            <option key={key} value={key}>
              {t.name}
            </option>
          ))}
        </select>

        <div className="window-controls">
          <button
            className="window-btn window-btn-minimize"
            onClick={() => appWindow.minimize()}
            aria-label="Minimize"
          >
            <svg width="10" height="1" viewBox="0 0 10 1">
              <rect width="10" height="1" fill="currentColor" />
            </svg>
          </button>
          <button
            className="window-btn window-btn-maximize"
            onClick={() => appWindow.toggleMaximize()}
            aria-label="Maximize"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <rect x="0.5" y="0.5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1" />
            </svg>
          </button>
          <button
            className="window-btn window-btn-close"
            onClick={() => appWindow.close()}
            aria-label="Close"
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
