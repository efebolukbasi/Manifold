/**
 * @manifold/cli — ModelStatus Component
 *
 * Shows the status of all connected AI models.
 */

import React from "react";
import { Box, Text } from "ink";
import type { BaseAdapter } from "@manifold/sdk";

interface ModelInfo {
  id: string;
  adapter: BaseAdapter;
}

interface ModelStatusProps {
  models: ModelInfo[];
  activeModelId: string | null;
}

export const ModelStatus: React.FC<ModelStatusProps> = ({
  models,
  activeModelId,
}) => {
  if (models.length === 0) {
    return (
      <Box paddingX={1}>
        <Text color="yellow">⚠ No models connected</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="row" gap={2} paddingX={1}>
      {models.map(({ id, adapter }) => {
        const isActive = id === activeModelId;
        const isReady = adapter.isReady();

        return (
          <Box key={id} gap={1}>
            <Text color={isReady ? "green" : "red"}>
              {isReady ? "●" : "○"}
            </Text>
            <Text bold={isActive} color={isActive ? "magenta" : "white"}>
              {adapter.getDisplayName()}
            </Text>
            <Text dimColor>({adapter.getRole()})</Text>
          </Box>
        );
      })}
    </Box>
  );
};
