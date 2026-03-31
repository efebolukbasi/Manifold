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

export function Header({
  layout,
  onLayoutChange,
  themeName,
  onThemeChange,
  theme,
}: HeaderProps) {
  return (
    <header
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
      </div>
    </header>
  );
}
