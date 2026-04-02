import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { TerminalPane } from "./TerminalPane";
import { ChatPane } from "./ChatPane";
import type { LayoutPreset, Theme } from "../themes";
import type { ChatMessage, BridgeModel } from "../session";
import type { BridgeStatus } from "../hooks/useBridge";

export type PaneMode = "terminal" | "chat";

interface PaneChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
}

interface TerminalGridProps {
  layout: LayoutPreset;
  theme: Theme;
  activePaneId: number;
  onActivatePane: (paneId: number) => void;
  paneModes: Record<number, PaneMode>;
  onTogglePaneMode: (paneId: number) => void;
  paneChats: Record<number, PaneChatState>;
  onChatSend: (paneId: number, input: string) => void;
  bridgeStatus: BridgeStatus;
  models: BridgeModel[];
}

const GUTTER_SIZE = 8;
const MIN_COLUMN_SIZE = 220;
const MIN_ROW_SIZE = 160;

interface GridShape {
  columns: number;
  rows: number;
}

interface ActiveDivider {
  axis: "column" | "row";
  index: number;
}

interface DragState extends ActiveDivider {
  availableSize: number;
  startFractions: number[];
  startPosition: number;
}

function getGridShape(layout: LayoutPreset): GridShape {
  switch (layout) {
    case 1:
      return { columns: 1, rows: 1 };
    case 2:
      return { columns: 2, rows: 1 };
    case 4:
      return { columns: 2, rows: 2 };
    case 6:
      return { columns: 3, rows: 2 };
    case 9:
      return { columns: 3, rows: 3 };
  }
}

function createEqualFractions(count: number): number[] {
  return Array.from({ length: count }, () => 1 / count);
}

function buildTrackTemplate(fractions: number[]): string {
  if (fractions.length === 1) {
    return "minmax(0, 1fr)";
  }

  const totalGutter = GUTTER_SIZE * (fractions.length - 1);

  return fractions
    .map((fraction, index) => {
      const track = `minmax(0, calc((100% - ${totalGutter}px) * ${fraction.toFixed(6)}))`;
      return index === fractions.length - 1
        ? track
        : `${track} ${GUTTER_SIZE}px`;
    })
    .join(" ");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function resizeFractions(
  fractions: number[],
  index: number,
  delta: number,
  availableSize: number,
  minSize: number,
): number[] {
  if (fractions.length < 2 || index < 0 || index >= fractions.length - 1) {
    return fractions;
  }

  const pairTotal = fractions[index] + fractions[index + 1];
  const minFraction = Math.min(minSize / Math.max(availableSize, 1), pairTotal / 2);
  const deltaFraction = delta / Math.max(availableSize, 1);
  const nextLeading = clamp(
    fractions[index] + deltaFraction,
    minFraction,
    pairTotal - minFraction,
  );
  const nextFractions = [...fractions];
  nextFractions[index] = nextLeading;
  nextFractions[index + 1] = pairTotal - nextLeading;
  return nextFractions;
}

export function TerminalGrid({
  layout,
  theme,
  activePaneId,
  onActivatePane,
  paneModes,
  onTogglePaneMode,
  paneChats,
  onChatSend,
  bridgeStatus,
  models,
}: TerminalGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const shape = getGridShape(layout);
  const [columnFractions, setColumnFractions] = useState<number[]>(() =>
    createEqualFractions(shape.columns),
  );
  const [rowFractions, setRowFractions] = useState<number[]>(() =>
    createEqualFractions(shape.rows),
  );
  const [activeDivider, setActiveDivider] = useState<ActiveDivider | null>(null);

  useEffect(() => {
    setColumnFractions((current) =>
      current.length === shape.columns
        ? current
        : createEqualFractions(shape.columns),
    );
    setRowFractions((current) =>
      current.length === shape.rows ? current : createEqualFractions(shape.rows),
    );
  }, [shape.columns, shape.rows]);

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      const dragState = dragStateRef.current;
      if (!dragState) {
        return;
      }

      const position =
        dragState.axis === "column" ? event.clientX : event.clientY;
      const nextFractions = resizeFractions(
        dragState.startFractions,
        dragState.index,
        position - dragState.startPosition,
        dragState.availableSize,
        dragState.axis === "column" ? MIN_COLUMN_SIZE : MIN_ROW_SIZE,
      );

      if (dragState.axis === "column") {
        setColumnFractions(nextFractions);
      } else {
        setRowFractions(nextFractions);
      }
    }

    function stopDragging() {
      if (!dragStateRef.current) {
        return;
      }

      dragStateRef.current = null;
      setActiveDivider(null);
      document.body.style.removeProperty("cursor");
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
      document.body.style.removeProperty("cursor");
    };
  }, []);

  function startDragging(
    axis: "column" | "row",
    index: number,
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (!gridRef.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const rect = gridRef.current.getBoundingClientRect();
    const fractions = axis === "column" ? columnFractions : rowFractions;
    const availableSize =
      (axis === "column" ? rect.width : rect.height) -
      GUTTER_SIZE * (fractions.length - 1);

    dragStateRef.current = {
      axis,
      index,
      availableSize: Math.max(availableSize, 1),
      startFractions: [...fractions],
      startPosition: axis === "column" ? event.clientX : event.clientY,
    };
    setActiveDivider({ axis, index });
    document.body.style.cursor = axis === "column" ? "col-resize" : "row-resize";
  }

  const columnTemplate = buildTrackTemplate(columnFractions);
  const rowTemplate = buildTrackTemplate(rowFractions);

  return (
    <div
      ref={gridRef}
      className="terminal-grid"
      style={{
        gridTemplateColumns: columnTemplate,
        gridTemplateRows: rowTemplate,
        background: theme.colors.paneBorder,
      }}
    >
      {Array.from({ length: layout }, (_, i) => {
        const mode = paneModes[i] || "terminal";
        const chatState = paneChats[i + 1]; // Bridge uses 1-indexed pane IDs
        const isActive = activePaneId === i;
        const columnIndex = i % shape.columns;
        const rowIndex = Math.floor(i / shape.columns);

        return (
          <div
            key={i}
            className="pane-slot"
            style={{
              gridColumn: columnIndex * 2 + 1,
              gridRow: rowIndex * 2 + 1,
            }}
          >
            {/* Mode toggle button */}
            {bridgeStatus === "ready" && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTogglePaneMode(i);
                }}
                title={mode === "terminal" ? "Switch to chat" : "Switch to terminal"}
                style={{
                  position: "absolute",
                  top: 4,
                  left: 8,
                  zIndex: 20,
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: 4,
                  color: theme.colors.fg,
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "2px 8px",
                  cursor: "pointer",
                  opacity: isActive ? 0.7 : 0.3,
                  transition: "opacity 0.15s ease",
                  fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: 0.5,
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.opacity = "1";
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.opacity = isActive
                    ? "0.7"
                    : "0.3";
                }}
              >
                {mode === "terminal" ? "TTY" : "AI"}
              </button>
            )}

            {mode === "terminal" ? (
              <TerminalPane
                paneId={i}
                isActive={isActive}
                onActivate={() => onActivatePane(i)}
                theme={theme}
              />
            ) : (
              <ChatPane
                paneId={i}
                isActive={isActive}
                onActivate={() => onActivatePane(i)}
                theme={theme}
                messages={chatState?.messages || []}
                isStreaming={chatState?.isStreaming || false}
                onSend={(input) => onChatSend(i + 1, input)} // 1-indexed for bridge
                modelName={models[0]?.name}
              />
            )}
          </div>
        );
      })}

      {Array.from({ length: shape.columns - 1 }, (_, index) => {
        const isDragging =
          activeDivider?.axis === "column" && activeDivider.index === index;

        return (
          <div
            key={`column-divider-${index}`}
            role="separator"
            aria-orientation="vertical"
            className={`terminal-divider vertical${isDragging ? " dragging" : ""}`}
            style={{ gridColumn: index * 2 + 2, gridRow: "1 / -1" }}
            onPointerDown={(event) => startDragging("column", index, event)}
          >
            <div
              className="terminal-divider-handle"
              style={{
                background: isDragging
                  ? theme.colors.paneBorderActive
                  : theme.colors.paneBorder,
              }}
            />
          </div>
        );
      })}

      {Array.from({ length: shape.rows - 1 }, (_, index) => {
        const isDragging =
          activeDivider?.axis === "row" && activeDivider.index === index;

        return (
          <div
            key={`row-divider-${index}`}
            role="separator"
            aria-orientation="horizontal"
            className={`terminal-divider horizontal${isDragging ? " dragging" : ""}`}
            style={{ gridColumn: "1 / -1", gridRow: index * 2 + 2 }}
            onPointerDown={(event) => startDragging("row", index, event)}
          >
            <div
              className="terminal-divider-handle"
              style={{
                background: isDragging
                  ? theme.colors.paneBorderActive
                  : theme.colors.paneBorder,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
