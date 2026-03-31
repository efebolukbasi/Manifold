import { useState } from "react";
import { TerminalPane } from "./TerminalPane";
import type { LayoutPreset, Theme } from "../themes";

interface TerminalGridProps {
  layout: LayoutPreset;
  theme: Theme;
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

export function TerminalGrid({ layout, theme }: TerminalGridProps) {
  const [activePaneId, setActivePaneId] = useState(0);
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
          onActivate={() => setActivePaneId(i)}
          theme={theme}
        />
      ))}
    </div>
  );
}
