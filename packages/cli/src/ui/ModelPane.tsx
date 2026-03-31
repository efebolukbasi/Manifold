import React from "react";
import { Box, Text } from "ink";
import type { ManifoldMessage, PaneStatus } from "@manifold/sdk";
import { ChatPane } from "./ChatPane.js";

interface ModelPaneProps {
  paneId: number;
  isActive: boolean;
  assignedModelId: string | null;
  assignedModelLabel: string;
  status: PaneStatus;
  messages: ManifoldMessage[];
}

export const ModelPane: React.FC<ModelPaneProps> = ({
  paneId,
  isActive,
  assignedModelId,
  assignedModelLabel,
  status,
  messages,
}) => {
  const statusColor = status === "busy" ? "yellow" : "gray";

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={isActive ? "cyan" : "gray"}
      flexGrow={1}
      marginRight={1}
      minHeight={10}
    >
      <Box justifyContent="space-between" paddingX={1}>
        <Text bold color={isActive ? "cyan" : "white"}>
          {`Pane ${paneId}`}
        </Text>
        <Text color={assignedModelId ? "green" : "yellow"}>
          {assignedModelLabel}
        </Text>
      </Box>

      <Box justifyContent="space-between" paddingX={1}>
        <Text dimColor>{isActive ? "active input target" : "inactive"}</Text>
        <Text color={statusColor}>{status}</Text>
      </Box>

      <Box flexGrow={1}>
        <ChatPane
          messages={messages}
          emptyMessage={
            assignedModelId
              ? `No messages for ${assignedModelId} yet.`
              : "No model assigned. Use /assign <pane> <model-id>."
          }
          maxVisible={18}
        />
      </Box>
    </Box>
  );
};
