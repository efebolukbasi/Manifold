/**
 * @manifold/cli — InputBar Component
 *
 * The text input bar at the bottom of the TUI.
 * Handles user input and command parsing.
 */

import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
// Note: ink-text-input v6 uses default export
import TextInput from "ink-text-input";

interface InputBarProps {
  onSubmit: (input: string) => void;
  isLoading: boolean;
  placeholder?: string;
}

export const InputBar: React.FC<InputBarProps> = ({
  onSubmit,
  isLoading,
  placeholder = "Type a message... (Ctrl+C to exit)",
}) => {
  const [value, setValue] = useState("");

  const handleSubmit = (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setValue("");
    onSubmit(trimmed);
  };

  return (
    <Box
      borderStyle="round"
      borderColor={isLoading ? "yellow" : "cyan"}
      paddingX={1}
    >
      {isLoading ? (
        <Text color="yellow">⟳ Thinking...</Text>
      ) : (
        <Box>
          <Text color="cyan" bold>
            {"❯ "}
          </Text>
          <TextInput
            value={value}
            onChange={setValue}
            onSubmit={handleSubmit}
            placeholder={placeholder}
          />
        </Box>
      )}
    </Box>
  );
};
