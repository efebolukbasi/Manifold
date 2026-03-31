import { TerminalPane } from "./TerminalPane";
import type { LayoutPreset, Theme } from "../themes";

interface TerminalGridProps {
  layout: LayoutPreset;
  theme: Theme;
  activePaneId: number;
  onActivatePane: (paneId: number) => void;
}

function getGridTemplate(layout: LayoutPreset) {
  switch (layout) {
    case 1:
      return { columns: "1fr", rows: "1fr" };
    case 2:
      return { columns: "1fr 1fr", rows: "1fr" };
    case 4:
      return { columns: "1fr 1fr", rows: "1fr 1fr" };
    case 6:
      return { columns: "1fr 1fr 1fr", rows: "1fr 1fr" };
    case 9:
      return { columns: "1fr 1fr 1fr", rows: "1fr 1fr 1fr" };
  }
}

export function TerminalGrid({
  layout,
  theme,
  activePaneId,
  onActivatePane,
}: TerminalGridProps) {
  const { columns, rows } = getGridTemplate(layout);

  return (
    <div
      className="terminal-grid"
      style={{
        gridTemplateColumns: columns,
        gridTemplateRows: rows,
        background: theme.colors.paneBorder,
      }}
    >
      {Array.from({ length: layout }, (_, i) => (
        <TerminalPane
          key={i}
          paneId={i}
          isActive={activePaneId === i}
          onActivate={() => onActivatePane(i)}
          theme={theme}
        />
      ))}
    </div>
  );
}
