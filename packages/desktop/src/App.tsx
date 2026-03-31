import { useState } from "react";
import { Header } from "./components/Header";
import { TerminalGrid } from "./components/TerminalGrid";
import { StatusBar } from "./components/StatusBar";
import { themes, type LayoutPreset } from "./themes";

export function App() {
  const [layout, setLayout] = useState<LayoutPreset>(2);
  const [themeName, setThemeName] = useState("midnight");
  const theme = themes[themeName] ?? themes.midnight;

  return (
    <div className="app" style={{ backgroundColor: theme.colors.bg }}>
      <Header
        layout={layout}
        onLayoutChange={setLayout}
        themeName={themeName}
        onThemeChange={setThemeName}
        theme={theme}
      />
      <TerminalGrid layout={layout} theme={theme} />
      <StatusBar layout={layout} theme={theme} />
    </div>
  );
}
