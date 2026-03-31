/**
 * @manifold/cli — ChatPane Component
 *
 * Displays the conversation history between the user and AI models.
 * Supports color-coded messages by model.
 */

import React from "react";
import { Box, Text } from "ink";
import type { ManifoldMessage } from "@manifold/sdk";

interface ChatPaneProps {
  messages: ManifoldMessage[];
  emptyMessage?: string;
  maxVisible?: number;
}

const MODEL_COLORS: Record<string, string> = {
  user: "green",
  claude: "magenta",
  gemini: "blue",
  openai: "cyan",
  codex: "yellow",
  orchestrator: "gray",
};

function getColor(from: string): string {
  return MODEL_COLORS[from] || "white";
}

function getPrefix(msg: ManifoldMessage): string {
  if (msg.from === "user") return "▸ You";
  if (msg.from === "orchestrator") return "⚙ System";
  return `◈ ${msg.from}`;
}

export const ChatPane: React.FC<ChatPaneProps> = ({
  messages,
  emptyMessage = "No messages yet. Type a message to begin...",
  maxVisible = 50,
}) => {
  const visibleMessages = messages.slice(-maxVisible);

  if (visibleMessages.length === 0) {
    return (
      <Box paddingX={1} paddingY={1}>
        <Text dimColor italic>
          {emptyMessage}
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1} flexGrow={1}>
      {visibleMessages.map((msg) => (
        <Box key={msg.id} flexDirection="column" marginBottom={1}>
          <Text color={getColor(msg.from)} bold>
            {getPrefix(msg)}
          </Text>
          <Box paddingLeft={2}>
            <Text wrap="wrap">
              {msg.type === "error" ? (
                <Text color="red">{msg.content}</Text>
              ) : (
                msg.content
              )}
            </Text>
          </Box>
        </Box>
      ))}
    </Box>
  );
};
