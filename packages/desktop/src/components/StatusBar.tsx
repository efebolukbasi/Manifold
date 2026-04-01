import { useState } from "react";
import type { LayoutPreset, Theme } from "../themes";
import type { BridgeStatus } from "../hooks/useBridge";
import type { BridgeModel } from "../session";
import type { PaneMode } from "./TerminalGrid";

interface StatusBarProps {
  layout: LayoutPreset;
  activePaneId: number;
  sessionId?: string;
  theme: Theme;
  bridgeStatus: BridgeStatus;
  bridgeModels: BridgeModel[];
  bridgeError: string | null;
  paneMode: PaneMode;
}

const STATUS_COLORS: Record<BridgeStatus, string> = {
  disconnected: "#666",
  connecting: "#e5c07b",
  ready: "#98c379",
  error: "#e06c75",
};

export function StatusBar({
  layout,
  activePaneId,
  sessionId,
  theme,
  bridgeStatus,
  bridgeModels,
  bridgeError,
  paneMode,
}: StatusBarProps) {
  const [showBridgeErrorDetails, setShowBridgeErrorDetails] = useState(false);
  const bridgeErrorSummary = bridgeError
    ? (() => {
        const singleLine = bridgeError.replace(/\s+/g, " ").trim();
        return singleLine.length > 120
          ? `${singleLine.slice(0, 117)}...`
          : singleLine;
      })()
    : null;

  async function copyBridgeError() {
    if (!bridgeError) return;

    try {
      await navigator.clipboard.writeText(bridgeError);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = bridgeError;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "absolute";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
  }

  return (
    <div
      className="status-bar"
      style={{ background: theme.colors.statusBg, color: theme.colors.statusFg }}
    >
      <div className="status-left">
        <span>
          <span
            className="status-dot"
            style={{ backgroundColor: theme.colors.accent }}
          />
          Manifold
        </span>
        <span>
          {layout} pane{layout > 1 ? "s" : ""}
        </span>
        <span>active pane {activePaneId + 1}</span>
        <span style={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
          {paneMode}
        </span>
      </div>
      <div className="status-right">
        {/* Bridge status */}
        <span className="bridge-status-chip">
          <span
            className="status-dot"
            style={{ backgroundColor: STATUS_COLORS[bridgeStatus] }}
          />
          {bridgeStatus === "ready" && bridgeModels.length > 0
            ? bridgeModels.map((m) => m.name).join(", ")
            : bridgeStatus === "error"
              ? bridgeErrorSummary || "bridge error"
              : bridgeStatus}
        </span>
        {bridgeStatus === "error" && bridgeError && (
          <>
            <button className="status-action-btn" onClick={() => void copyBridgeError()}>
              copy
            </button>
            <button
              className="status-action-btn"
              onClick={() => setShowBridgeErrorDetails((value) => !value)}
            >
              {showBridgeErrorDetails ? "hide" : "details"}
            </button>
          </>
        )}
        {sessionId && <span>session {sessionId.slice(0, 8)}</span>}
        <span>v0.1.0</span>
      </div>
      {showBridgeErrorDetails && bridgeError && (
        <div className="bridge-error-panel">
          <textarea readOnly value={bridgeError} className="bridge-error-textarea" />
        </div>
      )}
    </div>
  );
}
