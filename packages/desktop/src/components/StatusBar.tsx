import type { LayoutPreset, Theme } from "../themes";

interface StatusBarProps {
  layout: LayoutPreset;
  theme: Theme;
}

export function StatusBar({ layout, theme }: StatusBarProps) {
  return (
    <div
      className="status-bar"
      style={{ background: theme.colors.statusBg, color: theme.colors.statusFg }}
    >
      <div className="status-left">
        <span>
          <span
            className="status-dot"
            style={{ backgroundColor: theme.colors.accent }}
          />
          Manifold
        </span>
        <span>
          {layout} pane{layout > 1 ? "s" : ""}
        </span>
      </div>
      <div className="status-right">
        <span>v0.1.0</span>
      </div>
    </div>
  );
}
