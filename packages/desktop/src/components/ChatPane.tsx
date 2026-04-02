import { useEffect, useRef, useState } from "react";
import type { Theme } from "../themes";
import type { ChatMessage } from "../session";
import { Markdown } from "./Markdown";

interface ChatPaneProps {
  paneId: number;
  isActive: boolean;
  onActivate: () => void;
  theme: Theme;
  messages: ChatMessage[];
  isStreaming: boolean;
  onSend: (input: string) => void;
  modelName?: string;
}

export function ChatPane({
  paneId,
  isActive,
  onActivate,
  theme,
  messages,
  isStreaming,
  onSend,
  modelName,
}: ChatPaneProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when pane becomes active
  useEffect(() => {
    if (isActive) {
      inputRef.current?.focus();
    }
  }, [isActive]);

  function handleSubmit() {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div
      className={`chat-pane ${isActive ? "active" : ""}`}
      onClick={onActivate}
      style={{
        borderColor: isActive ? theme.colors.paneBorderActive : "transparent",
        background: theme.terminal.background,
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        position: "relative",
        border: "1px solid",
        borderTopColor: isActive ? theme.colors.paneBorderActive : "transparent",
        borderBottomColor: isActive ? theme.colors.paneBorderActive : "transparent",
        borderLeftColor: isActive ? theme.colors.paneBorderActive : "transparent",
        borderRightColor: isActive ? theme.colors.paneBorderActive : "transparent",
      }}
    >
      {/* Pane label */}
      <span
        className="pane-label"
        style={{
          color: theme.colors.fg,
          position: "absolute",
          top: 6,
          right: 10,
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: 0.5,
          opacity: 0.3,
          pointerEvents: "none",
          zIndex: 10,
          fontFamily:
            "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        }}
      >
        {paneId + 1}
        {modelName ? ` · ${modelName}` : ""}
      </span>

      {/* Messages area */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          minHeight: 0,
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              color: theme.colors.fg,
              opacity: 0.3,
              fontSize: 13,
              textAlign: "center",
              marginTop: "auto",
              marginBottom: "auto",
              fontFamily:
                "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
            }}
          >
            {modelName
              ? `Chat with ${modelName}`
              : "No model assigned"}
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.8,
                textTransform: "uppercase",
                color: msg.role === "user" ? theme.colors.accent : theme.colors.fg,
                opacity: msg.role === "user" ? 1 : 0.6,
              }}
            >
              {msg.role === "user" ? "You" : modelName || "Assistant"}
            </span>
            {msg.role === "assistant" ? (
              <Markdown content={msg.content} theme={theme} />
            ) : (
              <div
                style={{
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: theme.colors.fg,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontFamily:
                    "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                }}
              >
                {msg.content}
              </div>
            )}
          </div>
        ))}

        {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
          <div
            style={{
              fontSize: 13,
              color: theme.colors.fg,
              opacity: 0.5,
              fontFamily:
                "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
            }}
          >
            Thinking...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div
        style={{
          borderTop: `1px solid rgba(255, 255, 255, 0.06)`,
          padding: 8,
          display: "flex",
          gap: 8,
        }}
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isStreaming ? "Waiting for response..." : "Type a message..."}
          disabled={isStreaming}
          rows={1}
          style={{
            flex: 1,
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: 8,
            color: theme.colors.fg,
            padding: "8px 12px",
            fontSize: 13,
            fontFamily:
              "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
            resize: "none",
            outline: "none",
            lineHeight: 1.4,
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={isStreaming || !input.trim()}
          style={{
            background: theme.colors.accent,
            color: "#000",
            border: "none",
            borderRadius: 8,
            padding: "8px 16px",
            fontSize: 12,
            fontWeight: 700,
            cursor: isStreaming || !input.trim() ? "default" : "pointer",
            opacity: isStreaming || !input.trim() ? 0.4 : 1,
            fontFamily: "inherit",
            flexShrink: 0,
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
