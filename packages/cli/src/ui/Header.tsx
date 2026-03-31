/**
 * @manifold/cli — Header Component
 *
 * Displays the Manifold branding and session status at the top of the TUI.
 */

import React from "react";
import { Box, Text } from "ink";

interface HeaderProps {
  projectName: string;
  activeModel: string | null;
  activePane: number;
  layoutCount: number;
  mode: string;
  modelCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  projectName,
  activeModel,
  activePane,
  layoutCount,
  mode,
  modelCount,
}) => {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="magenta"
      paddingX={1}
    >
      <Box justifyContent="space-between">
        <Text bold color="magenta">
          ◈ MANIFOLD
        </Text>
        <Text dimColor>
          {projectName}
        </Text>
      </Box>
      <Box gap={2}>
        <Text>
          <Text color="cyan" bold>model:</Text>{" "}
          <Text color="white">{activeModel || "none"}</Text>
        </Text>
        <Text>
          <Text color="cyan" bold>pane:</Text>{" "}
          <Text color="white">{activePane}</Text>
        </Text>
        <Text>
          <Text color="cyan" bold>layout:</Text>{" "}
          <Text color="white">{layoutCount}</Text>
        </Text>
        <Text>
          <Text color="cyan" bold>mode:</Text>{" "}
          <Text color="white">{mode}</Text>
        </Text>
        <Text>
          <Text color="cyan" bold>connected:</Text>{" "}
          <Text color="green">{modelCount}</Text>
        </Text>
      </Box>
    </Box>
  );
};
