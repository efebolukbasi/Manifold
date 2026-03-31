/**
 * @manifold/cli - Main App Component
 *
 * Multi-pane terminal UI with pane-aware model assignment.
 */

import React, { useEffect, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import {
  createDelegationMessage,
  createSystemMessage,
  type ManifoldMessage,
} from "@manifold/sdk";
import type { Orchestrator } from "@manifold/core";
import { Header } from "./Header.js";
import { ModelStatus } from "./ModelStatus.js";
import { InputBar } from "./InputBar.js";
import { ModelPane } from "./ModelPane.js";

interface AppProps {
  orchestrator: Orchestrator;
}

interface PaneState {
  id: number;
  modelId: string | null;
}

const MAX_LAYOUTS = 4;

function buildInitialPanes(modelIds: string[], activeModel: string | null): PaneState[] {
  const fallbackModel = activeModel ?? modelIds[0] ?? null;

  return Array.from({ length: MAX_LAYOUTS }, (_, index) => ({
    id: index + 1,
    modelId: index === 0 ? fallbackModel : modelIds[index] ?? null,
  }));
}

function reconcilePanes(panes: PaneState[], modelIds: string[]): PaneState[] {
  const fallbackModel = modelIds[0] ?? null;

  return panes.map((pane, index) => {
    if (pane.modelId && modelIds.includes(pane.modelId)) {
      return pane;
    }

    if (index === 0) {
      return { ...pane, modelId: fallbackModel };
    }

    return { ...pane, modelId: modelIds[index] ?? pane.modelId ?? null };
  });
}

function filterMessagesForPane(
  messages: ManifoldMessage[],
  modelId: string | null
): ManifoldMessage[] {
  if (!modelId) {
    return [];
  }

  return messages.filter((message) => {
    if (message.to === "all") {
      return true;
    }

    return message.from === modelId || message.to === modelId;
  });
}

function parsePaneNumber(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_LAYOUTS) {
    return null;
  }

  return parsed;
}

function getPaneById(panes: PaneState[], paneId: number): PaneState | undefined {
  return panes.find((pane) => pane.id === paneId);
}

export const App: React.FC<AppProps> = ({ orchestrator }) => {
  const { exit } = useApp();
  const readyModels = orchestrator.getReadyModels();
  const readyModelIds = readyModels.map((model) => model.id);
  const [messages, setMessages] = useState<ManifoldMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [layoutCount, setLayoutCount] = useState(1);
  const [activePaneId, setActivePaneId] = useState(1);
  const [panes, setPanes] = useState<PaneState[]>(() =>
    buildInitialPanes(readyModelIds, orchestrator.getActiveModel())
  );

  useEffect(() => {
    const handler = (message: ManifoldMessage) => {
      setMessages((prev) => [...prev, message]);
    };

    orchestrator.messageBus.on("message", handler);
    return () => {
      orchestrator.messageBus.off("message", handler);
    };
  }, [orchestrator]);

  useEffect(() => {
    setPanes((prev) => reconcilePanes(prev, readyModelIds));
  }, [readyModels.length]);

  useEffect(() => {
    const activePane = getPaneById(panes, activePaneId);
    if (activePane?.modelId) {
      orchestrator.setActiveModel(activePane.modelId);
    }
  }, [activePaneId, orchestrator, panes]);

  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      orchestrator.shutdown().then(() => exit());
    }
  });

  async function submitToPane(input: string, paneId: number): Promise<void> {
    const pane = getPaneById(panes, paneId);
    if (!pane?.modelId) {
      setFeedback(`Pane ${paneId} has no assigned model.`);
      return;
    }

    orchestrator.setActiveModel(pane.modelId);
    setIsLoading(true);
    setFeedback(null);

    try {
      await orchestrator.chat(input);
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "An unknown error occurred"
      );
    } finally {
      setIsLoading(false);
    }
  }

  function resolveModelReference(value: string | undefined): string | null {
    if (!value) {
      return null;
    }

    const paneNumber = parsePaneNumber(value);
    if (paneNumber) {
      return getPaneById(panes, paneNumber)?.modelId ?? null;
    }

    return readyModelIds.includes(value) ? value : null;
  }

  function showConnectedModels(): void {
    const details = readyModels
      .map((model) => {
        const paneIds = panes
          .filter((pane) => pane.modelId === model.id)
          .map((pane) => pane.id)
          .join(", ");
        const paneSuffix = paneIds ? ` panes: ${paneIds}` : " panes: none";
        return `  ${model.id} (${model.adapter.getRole()}) - ${model.adapter.getDisplayName()}${paneSuffix}`;
      })
      .join("\n");

    setFeedback(`Connected models:\n${details}`);
  }

  async function handleSubmit(input: string): Promise<void> {
    if (input.startsWith("/")) {
      handleCommand(input);
      return;
    }

    await submitToPane(input, activePaneId);
  }

  function handleCommand(input: string): void {
    const parts = input.slice(1).split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1);

    switch (command) {
      case "layout": {
        const nextLayout = parsePaneNumber(args[0]);
        if (!nextLayout) {
          setFeedback("Usage: /layout <1-4>");
          return;
        }

        setLayoutCount(nextLayout);
        if (activePaneId > nextLayout) {
          setActivePaneId(1);
        }
        setFeedback(`Layout changed to ${nextLayout} pane(s).`);
        return;
      }

      case "focus": {
        const paneId = parsePaneNumber(args[0]);
        if (!paneId || paneId > layoutCount) {
          setFeedback(`Usage: /focus <1-${layoutCount}>`);
          return;
        }

        setActivePaneId(paneId);
        setFeedback(`Focused pane ${paneId}.`);
        return;
      }

      case "assign": {
        const paneId = parsePaneNumber(args[0]);
        const modelId = args[1];

        if (!paneId || !modelId) {
          setFeedback("Usage: /assign <pane> <model-id>");
          return;
        }

        if (!readyModelIds.includes(modelId)) {
          setFeedback(`Unknown model "${modelId}". Use /models to list available models.`);
          return;
        }

        setPanes((prev) =>
          prev.map((pane) =>
            pane.id === paneId ? { ...pane, modelId } : pane
          )
        );

        if (paneId === activePaneId) {
          orchestrator.setActiveModel(modelId);
        }

        setFeedback(`Assigned pane ${paneId} to ${modelId}.`);
        return;
      }

      case "model":
      case "switch": {
        const modelId = args[0];
        if (!modelId) {
          setFeedback("Usage: /model <model-id>");
          return;
        }

        if (!readyModelIds.includes(modelId)) {
          setFeedback(`Unknown model "${modelId}". Use /models to list available models.`);
          return;
        }

        setPanes((prev) =>
          prev.map((pane) =>
            pane.id === activePaneId ? { ...pane, modelId } : pane
          )
        );
        orchestrator.setActiveModel(modelId);
        setFeedback(`Pane ${activePaneId} now targets ${modelId}.`);
        return;
      }

      case "send": {
        const paneId = parsePaneNumber(args[0]);
        const content = args.slice(1).join(" ").trim();

        if (!paneId || !content) {
          setFeedback("Usage: /send <pane> <message>");
          return;
        }

        void submitToPane(content, paneId);
        return;
      }

      case "delegate": {
        const fromModel = resolveModelReference(args[0]);
        const toModel = resolveModelReference(args[1]);
        const content = args.slice(2).join(" ").trim();

        if (!fromModel || !toModel || !content) {
          setFeedback("Usage: /delegate <from-pane|model> <to-pane|model> <message>");
          return;
        }

        orchestrator.messageBus.publish(
          createDelegationMessage(fromModel, toModel, content)
        );
        setFeedback(`Delegated from ${fromModel} to ${toModel}.`);
        return;
      }

      case "broadcast": {
        const content = args.join(" ").trim();
        if (!content) {
          setFeedback("Usage: /broadcast <message>");
          return;
        }

        orchestrator.messageBus.publish(createSystemMessage(content, "all"));
        setFeedback("Broadcast sent.");
        return;
      }

      case "mode": {
        const mode = args[0];
        if (!mode) {
          setFeedback(
            "Usage: /mode <solo|collaborative|autonomous|consensus|pipeline>"
          );
          return;
        }

        orchestrator.setMode(mode as Parameters<typeof orchestrator.setMode>[0]);
        setFeedback(`Mode changed to ${mode}.`);
        return;
      }

      case "models":
        showConnectedModels();
        return;

      case "clear":
        setMessages([]);
        setFeedback("Cleared local pane history.");
        return;

      case "help":
        setFeedback(
          [
            "Available commands:",
            "  /layout <1-4>                             Set pane layout count",
            "  /focus <pane>                             Focus a pane for input",
            "  /assign <pane> <model-id>                 Assign a model to a pane",
            "  /model <model-id>                         Assign current pane to a model",
            "  /send <pane> <message>                    Send a prompt directly to a pane",
            "  /delegate <from-pane|model> <to-pane|model> <message>",
            "  /broadcast <message>                      Publish a shared system update",
            "  /mode <solo|collaborative|autonomous|consensus|pipeline>",
            "  /models                                   List connected models and pane usage",
            "  /clear                                    Clear local message history",
            "  /help                                     Show this help",
            "  Ctrl+C                                    Exit",
          ].join("\n")
        );
        return;

      default:
        setFeedback(`Unknown command: /${command}. Type /help for available commands.`);
    }
  }

  const visiblePanes = panes.slice(0, layoutCount);
  const topRow = visiblePanes.length <= 2 ? visiblePanes : visiblePanes.slice(0, 2);
  const bottomRow = visiblePanes.length <= 2 ? [] : visiblePanes.slice(2, 4);
  const activeModelId = getPaneById(panes, activePaneId)?.modelId ?? orchestrator.getActiveModel();
  const inputPlaceholder = activeModelId
    ? `Send to pane ${activePaneId} (${activeModelId})`
    : `Pane ${activePaneId} has no model. Use /assign <pane> <model-id>.`;

  return (
    <Box flexDirection="column" height="100%">
      <Header
        projectName={orchestrator.config.project.name}
        activeModel={activeModelId}
        activePane={activePaneId}
        layoutCount={layoutCount}
        mode={orchestrator.getMode()}
        modelCount={readyModels.length}
      />

      <ModelStatus
        models={readyModels}
        activeModelId={activeModelId}
      />

      <Box flexDirection="column" flexGrow={1} marginY={1}>
        <Box flexDirection="row" flexGrow={1}>
          {topRow.map((pane, index) => (
            <ModelPane
              key={pane.id}
              paneId={pane.id}
              isActive={pane.id === activePaneId}
              assignedModelId={pane.modelId}
              assignedModelLabel={pane.modelId ?? "unassigned"}
              messages={filterMessagesForPane(messages, pane.modelId)}
            />
          ))}
          {topRow.length === 1 && layoutCount === 1 ? null : null}
        </Box>

        {bottomRow.length > 0 && (
          <Box flexDirection="row" flexGrow={1} marginTop={1}>
            {bottomRow.map((pane) => (
              <ModelPane
                key={pane.id}
                paneId={pane.id}
                isActive={pane.id === activePaneId}
                assignedModelId={pane.modelId}
                assignedModelLabel={pane.modelId ?? "unassigned"}
                messages={filterMessagesForPane(messages, pane.modelId)}
              />
            ))}
          </Box>
        )}
      </Box>

      {feedback && (
        <Box paddingX={1}>
          <Text color="yellow">{feedback}</Text>
        </Box>
      )}

      <InputBar
        onSubmit={(value) => {
          void handleSubmit(value);
        }}
        isLoading={isLoading}
        placeholder={inputPlaceholder}
      />
    </Box>
  );
};
