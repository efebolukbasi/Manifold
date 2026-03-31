import type { LayoutPreset, Theme } from "../themes";

interface StatusBarProps {
  layout: LayoutPreset;
  activePaneId: number;
  sessionId?: string;
  theme: Theme;
}

export function StatusBar({
  layout,
  activePaneId,
  sessionId,
  theme,
}: StatusBarProps) {
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
        <span>active pane {activePaneId + 1}</span>
      </div>
      <div className="status-right">
        {sessionId && <span>session {sessionId.slice(0, 8)}</span>}
        <span>v0.1.0</span>
      </div>
    </div>
  );
}
