import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { WebglAddon } from "@xterm/addon-webgl";
import { FitAddon } from "@xterm/addon-fit";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Theme } from "../themes";

interface TerminalPaneProps {
  paneId: number;
  isActive: boolean;
  onActivate: () => void;
  theme: Theme;
}

export function TerminalPane({
  paneId,
  isActive,
  onActivate,
  theme,
}: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const ptyIdRef = useRef<string | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Mount terminal + PTY
  useEffect(() => {
    if (!containerRef.current) return;

    const terminal = new Terminal({
      cursorBlink: true,
      cursorStyle: "bar",
      fontSize: 13,
      fontFamily:
        "'JetBrains Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace",
      lineHeight: 1.2,
      theme: {
        background: theme.terminal.background,
        foreground: theme.terminal.foreground,
        cursor: theme.terminal.cursor,
        cursorAccent: theme.terminal.cursorAccent,
        selectionBackground: theme.terminal.selectionBackground,
      },
      allowTransparency: true,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(containerRef.current);

    // Try GPU-accelerated WebGL rendering
    try {
      terminal.loadAddon(new WebglAddon());
    } catch {
      // Falls back to canvas renderer
    }

    fitAddon.fit();
    termRef.current = terminal;
    fitRef.current = fitAddon;

    // Create PTY and wire up I/O
    let outputUnlisten: (() => void) | undefined;
    let exitUnlisten: (() => void) | undefined;

    (async () => {
      try {
        const { cols, rows } = terminal;
        const id = await invoke<string>("create_pty", { rows, cols });
        ptyIdRef.current = id;

        outputUnlisten = await listen<string>(
          `pty-output-${id}`,
          (event) => {
            terminal.write(event.payload);
          },
        );

        exitUnlisten = await listen(`pty-exit-${id}`, () => {
          terminal.write("\r\n\x1b[90m[process exited]\x1b[0m\r\n");
        });

        terminal.onData((data) => {
          if (ptyIdRef.current) {
            invoke("write_pty", { id: ptyIdRef.current, data });
          }
        });

        terminal.onResize(({ cols, rows }) => {
          if (ptyIdRef.current) {
            invoke("resize_pty", { id: ptyIdRef.current, rows, cols });
          }
        });
      } catch (e) {
        terminal.write(`\r\n\x1b[31mFailed to create PTY: ${e}\x1b[0m\r\n`);
      }
    })();

    // Resize terminal when container resizes
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => fitAddon.fit());
    });
    resizeObserver.observe(containerRef.current);

    cleanupRef.current = () => {
      resizeObserver.disconnect();
      outputUnlisten?.();
      exitUnlisten?.();
      if (ptyIdRef.current) {
        invoke("close_pty", { id: ptyIdRef.current });
        ptyIdRef.current = null;
      }
      terminal.dispose();
    };

    return () => {
      cleanupRef.current?.();
    };
  }, []); // Mount once

  // Update terminal theme when it changes
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = {
        background: theme.terminal.background,
        foreground: theme.terminal.foreground,
        cursor: theme.terminal.cursor,
        cursorAccent: theme.terminal.cursorAccent,
        selectionBackground: theme.terminal.selectionBackground,
      };
    }
  }, [theme]);

  // Focus active pane
  useEffect(() => {
    if (isActive && termRef.current) {
      termRef.current.focus();
    }
  }, [isActive]);

  return (
    <div
      className={`terminal-pane ${isActive ? "active" : ""}`}
      onClick={onActivate}
      ref={containerRef}
      style={{
        borderColor: isActive
          ? theme.colors.paneBorderActive
          : "transparent",
        background: theme.terminal.background,
      }}
    >
      <span className="pane-label" style={{ color: theme.colors.fg }}>
        {paneId + 1}
      </span>
    </div>
  );
}
