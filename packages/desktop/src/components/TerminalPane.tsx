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

interface PtyAttachState {
  bufferedOutput: string;
  hasExited: boolean;
}

export function TerminalPane({
  paneId,
  isActive,
  onActivate,
  theme,
}: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

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
    fitAddonRef.current = fitAddon;
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

    // Create PTY and wire up I/O
    let isDisposed = false;
    let ptyId: string | null = null;
    let outputUnlisten: (() => void) | undefined;
    let exitUnlisten: (() => void) | undefined;

    const dataDisposable = terminal.onData((data) => {
      if (ptyId) {
        void invoke("write_pty", { id: ptyId, data });
      }
    });

    const resizeDisposable = terminal.onResize(({ cols, rows }) => {
      if (ptyId) {
        void invoke("resize_pty", { id: ptyId, rows, cols });
      }
    });

    void (async () => {
      try {
        const { cols, rows } = terminal;
        const id = await invoke<string>("create_pty", { rows, cols });

        if (isDisposed) {
          void invoke("close_pty", { id });
          return;
        }

        ptyId = id;

        outputUnlisten = await listen<string>(
          `pty-output-${id}`,
          (event) => {
            terminal.write(event.payload);
          },
        );

        if (isDisposed) {
          outputUnlisten();
          void invoke("close_pty", { id });
          return;
        }

        exitUnlisten = await listen(`pty-exit-${id}`, () => {
          terminal.write("\r\n\x1b[90m[process exited]\x1b[0m\r\n");
        });

        const attachState = await invoke<PtyAttachState>("attach_pty", { id });
        if (attachState.bufferedOutput) {
          terminal.write(attachState.bufferedOutput);
        }
        if (attachState.hasExited) {
          terminal.write("\r\n\x1b[90m[process exited]\x1b[0m\r\n");
        }
      } catch (e) {
        if (!isDisposed) {
          terminal.write(`\r\n\x1b[31mFailed to create PTY: ${e}\x1b[0m\r\n`);
        }
      }
    })();

    // Resize terminal when container resizes
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => fitAddon.fit());
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      isDisposed = true;
      resizeObserver.disconnect();
      dataDisposable.dispose();
      resizeDisposable.dispose();
      outputUnlisten?.();
      exitUnlisten?.();
      if (ptyId) {
        void invoke("close_pty", { id: ptyId });
        ptyId = null;
      }
      fitAddonRef.current = null;
      termRef.current = null;
      terminal.dispose();
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
      requestAnimationFrame(() => fitAddonRef.current?.fit());
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
