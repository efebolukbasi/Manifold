export type LayoutPreset = 1 | 2 | 4 | 6 | 9;

export interface Theme {
  name: string;
  colors: {
    bg: string;
    fg: string;
    headerBg: string;
    headerFg: string;
    paneBorder: string;
    paneBorderActive: string;
    statusBg: string;
    statusFg: string;
    accent: string;
  };
  terminal: {
    background: string;
    foreground: string;
    cursor: string;
    cursorAccent: string;
    selectionBackground: string;
  };
}

export const themes: Record<string, Theme> = {
  midnight: {
    name: "Midnight",
    colors: {
      bg: "#0a0a0f",
      fg: "#e0e0e8",
      headerBg: "#101018",
      headerFg: "#e0e0e8",
      paneBorder: "#1a1a28",
      paneBorderActive: "#7c3aed",
      statusBg: "#101018",
      statusFg: "#606078",
      accent: "#7c3aed",
    },
    terminal: {
      background: "#0a0a0f",
      foreground: "#e0e0e8",
      cursor: "#7c3aed",
      cursorAccent: "#0a0a0f",
      selectionBackground: "#7c3aed40",
    },
  },

  nord: {
    name: "Nord",
    colors: {
      bg: "#2e3440",
      fg: "#eceff4",
      headerBg: "#3b4252",
      headerFg: "#eceff4",
      paneBorder: "#434c5e",
      paneBorderActive: "#88c0d0",
      statusBg: "#3b4252",
      statusFg: "#d8dee9",
      accent: "#88c0d0",
    },
    terminal: {
      background: "#2e3440",
      foreground: "#eceff4",
      cursor: "#88c0d0",
      cursorAccent: "#2e3440",
      selectionBackground: "#88c0d040",
    },
  },

  dracula: {
    name: "Dracula",
    colors: {
      bg: "#282a36",
      fg: "#f8f8f2",
      headerBg: "#21222c",
      headerFg: "#f8f8f2",
      paneBorder: "#44475a",
      paneBorderActive: "#bd93f9",
      statusBg: "#21222c",
      statusFg: "#6272a4",
      accent: "#bd93f9",
    },
    terminal: {
      background: "#282a36",
      foreground: "#f8f8f2",
      cursor: "#bd93f9",
      cursorAccent: "#282a36",
      selectionBackground: "#bd93f940",
    },
  },

  aurora: {
    name: "Aurora",
    colors: {
      bg: "#0d1117",
      fg: "#c9d1d9",
      headerBg: "#161b22",
      headerFg: "#c9d1d9",
      paneBorder: "#21262d",
      paneBorderActive: "#58a6ff",
      statusBg: "#161b22",
      statusFg: "#8b949e",
      accent: "#58a6ff",
    },
    terminal: {
      background: "#0d1117",
      foreground: "#c9d1d9",
      cursor: "#58a6ff",
      cursorAccent: "#0d1117",
      selectionBackground: "#58a6ff40",
    },
  },

  cyberpunk: {
    name: "Cyberpunk",
    colors: {
      bg: "#0a0a12",
      fg: "#00ff9f",
      headerBg: "#0f0f1a",
      headerFg: "#00ff9f",
      paneBorder: "#1a1a2e",
      paneBorderActive: "#ff0080",
      statusBg: "#0f0f1a",
      statusFg: "#00cc7f",
      accent: "#ff0080",
    },
    terminal: {
      background: "#0a0a12",
      foreground: "#00ff9f",
      cursor: "#ff0080",
      cursorAccent: "#0a0a12",
      selectionBackground: "#ff008040",
    },
  },
};
