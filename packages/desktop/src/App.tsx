import { useCallback, useEffect, useRef, useState } from "react";
import { Header } from "./components/Header";
import { TerminalGrid, type PaneMode } from "./components/TerminalGrid";
import { WorklogPanel } from "./components/WorklogPanel";
import { StatusBar } from "./components/StatusBar";
import { useSharedSession } from "./hooks/useSharedSession";
import { useBridge } from "./hooks/useBridge";
import type { WorklogEntryDraft } from "./session";
import { themes, type LayoutPreset } from "./themes";

const FALLBACK_LAYOUT: LayoutPreset = 2;

function coerceLayoutPreset(value: number): LayoutPreset {
  switch (value) {
    case 1:
    case 2:
    case 4:
    case 6:
    case 9:
      return value;
    default:
      return FALLBACK_LAYOUT;
  }
}

export function App() {
  const [layout, setLayout] = useState<LayoutPreset>(FALLBACK_LAYOUT);
  const [activePaneId, setActivePaneId] = useState(0);
  const [themeName, setThemeName] = useState("midnight");
  const [paneModes, setPaneModes] = useState<Record<number, PaneMode>>({});
  const hasHydratedSession = useRef(false);
  const {
    sessionState,
    isLoading: isSessionLoading,
    error: sessionError,
    initializeSession,
    syncSession,
    saveWorklogEntry,
  } = useSharedSession();
  const bridge = useBridge();
  const theme = themes[themeName] ?? themes.midnight;

  // Initialize session on mount
  useEffect(() => {
    void initializeSession(FALLBACK_LAYOUT, 1)
      .then((state) => {
        const hydratedLayout = coerceLayoutPreset(state.session.paneCount);
        setLayout(hydratedLayout);
        setActivePaneId(
          Math.min(
            Math.max(state.session.activePaneId - 1, 0),
            hydratedLayout - 1,
          ),
        );
        hasHydratedSession.current = true;

        // Initialize the orchestrator bridge with the project root
        void bridge.initBridge(state.projectRoot).catch((err) => {
          console.warn("Bridge initialization failed:", err);
        });
      })
      .catch(() => {
        hasHydratedSession.current = true;
      });
  }, [initializeSession]);

  // Set up bridge pane listeners when bridge is ready
  useEffect(() => {
    if (bridge.status !== "ready") return;

    // Set up listeners for all possible panes (1-indexed, up to 9)
    for (let i = 1; i <= 9; i++) {
      void bridge.setupPaneListeners(i);
    }
  }, [bridge.status, bridge.setupPaneListeners]);

  // Sync session when layout/activePane changes
  useEffect(() => {
    if (!hasHydratedSession.current) return;
    void syncSession(layout, activePaneId + 1);
  }, [activePaneId, layout, syncSession]);

  function handleLayoutChange(nextLayout: LayoutPreset) {
    setLayout(nextLayout);
    setActivePaneId((prev) => Math.min(prev, nextLayout - 1));
  }

  const handleTogglePaneMode = useCallback((paneId: number) => {
    setPaneModes((prev) => ({
      ...prev,
      [paneId]: prev[paneId] === "chat" ? "terminal" : "chat",
    }));
  }, []);

  const handleChatSend = useCallback(
    (paneId: number, input: string) => {
      void bridge.chatInPane(paneId, input);
    },
    [bridge.chatInPane],
  );

  async function handleSaveWorklogEntry(draft: WorklogEntryDraft) {
    await saveWorklogEntry(draft, layout, activePaneId + 1);
  }

  return (
    <div className="app" style={{ backgroundColor: theme.colors.bg }}>
      <Header
        layout={layout}
        onLayoutChange={handleLayoutChange}
        themeName={themeName}
        onThemeChange={setThemeName}
        theme={theme}
      />
      <div className="workspace-shell">
        <TerminalGrid
          layout={layout}
          activePaneId={activePaneId}
          onActivatePane={setActivePaneId}
          theme={theme}
          paneModes={paneModes}
          onTogglePaneMode={handleTogglePaneMode}
          paneChats={bridge.paneChats}
          onChatSend={handleChatSend}
          bridgeStatus={bridge.status}
          models={bridge.models}
        />
        <WorklogPanel
          activePaneId={activePaneId}
          isSessionLoading={isSessionLoading}
          layout={layout}
          onSave={handleSaveWorklogEntry}
          sessionError={sessionError}
          sessionState={sessionState}
          theme={theme}
        />
      </div>
      <StatusBar
        activePaneId={activePaneId}
        layout={layout}
        sessionId={sessionState?.session.id}
        theme={theme}
        bridgeStatus={bridge.status}
        bridgeModels={bridge.models}
        bridgeError={bridge.error}
        paneMode={paneModes[activePaneId] || "terminal"}
      />
    </div>
  );
}
