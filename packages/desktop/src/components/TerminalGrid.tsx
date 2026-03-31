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
  paneModes,
  onTogglePaneMode,
  paneChats,
  onChatSend,
  bridgeStatus,
  models,
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
      {Array.from({ length: layout }, (_, i) => {
        const mode = paneModes[i] || "terminal";
        const chatState = paneChats[i + 1]; // Bridge uses 1-indexed pane IDs
        const isActive = activePaneId === i;

        return (
          <div key={i} style={{ position: "relative", overflow: "hidden" }}>
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
    </div>
  );
}
