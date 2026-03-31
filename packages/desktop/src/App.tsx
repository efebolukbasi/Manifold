import { useEffect, useRef, useState } from "react";
import { Header } from "./components/Header";
import { TerminalGrid } from "./components/TerminalGrid";
import { WorklogPanel } from "./components/WorklogPanel";
import { StatusBar } from "./components/StatusBar";
import { useSharedSession } from "./hooks/useSharedSession";
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
  const hasHydratedSession = useRef(false);
  const {
    sessionState,
    isLoading: isSessionLoading,
    error: sessionError,
    initializeSession,
    syncSession,
    saveWorklogEntry,
  } = useSharedSession();
  const theme = themes[themeName] ?? themes.midnight;

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
      })
      .catch(() => {
        hasHydratedSession.current = true;
      });
  }, [initializeSession]);

  useEffect(() => {
    if (!hasHydratedSession.current) {
      return;
    }

    void syncSession(layout, activePaneId + 1);
  }, [activePaneId, layout, syncSession]);

  function handleLayoutChange(nextLayout: LayoutPreset) {
    setLayout(nextLayout);
    setActivePaneId((prev) => Math.min(prev, nextLayout - 1));
  }

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
      />
    </div>
  );
}
