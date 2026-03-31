import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { ChatMessage, BridgeModel, StreamEventData } from "../session";

export type BridgeStatus = "disconnected" | "connecting" | "ready" | "error";

interface PaneChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
}

export function useBridge() {
  const [status, setStatus] = useState<BridgeStatus>("disconnected");
  const [models, setModels] = useState<BridgeModel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [paneChats, setPaneChats] = useState<Record<number, PaneChatState>>({});
  const unlisteners = useRef<Array<() => void>>([]);

  // Clean up listeners on unmount
  useEffect(() => {
    return () => {
      for (const unlisten of unlisteners.current) {
        unlisten();
      }
    };
  }, []);

  const initBridge = useCallback(async (projectRoot: string) => {
    setStatus("connecting");
    setError(null);

    try {
      const response = await invoke<{
        event: string;
        models: BridgeModel[];
        panes: unknown[];
        sessionId?: string;
      }>("bridge_initialize", { projectRoot });

      setModels(response.models || []);
      setStatus("ready");

      // Listen for disconnect
      const unlisten = await listen("bridge-disconnected", () => {
        setStatus("disconnected");
        setModels([]);
      });
      unlisteners.current.push(unlisten);

      return response;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setStatus("error");
      throw err;
    }
  }, []);

  const setupPaneListeners = useCallback(async (paneId: number) => {
    // Listen for stream events on this pane
    const streamUnlisten = await listen<StreamEventData>(
      `bridge-stream-${paneId}`,
      (event) => {
        const data = event.payload;

        if (data.type === "text_delta") {
          setPaneChats((prev) => {
            const paneState = prev[paneId] || { messages: [], isStreaming: false };
            const msgs = [...paneState.messages];
            const last = msgs[msgs.length - 1];

            if (last && last.role === "assistant") {
              // Append to existing assistant message
              msgs[msgs.length - 1] = {
                ...last,
                content: last.content + data.content,
              };
            } else {
              // Start new assistant message
              msgs.push({
                role: "assistant",
                content: data.content,
                timestamp: new Date().toISOString(),
              });
            }

            return { ...prev, [paneId]: { messages: msgs, isStreaming: true } };
          });
        }
      },
    );
    unlisteners.current.push(streamUnlisten);

    const endUnlisten = await listen(
      `bridge-stream-end-${paneId}`,
      () => {
        setPaneChats((prev) => {
          const paneState = prev[paneId] || { messages: [], isStreaming: false };
          return { ...prev, [paneId]: { ...paneState, isStreaming: false } };
        });
      },
    );
    unlisteners.current.push(endUnlisten);

    const errorUnlisten = await listen<string>(
      `bridge-error-${paneId}`,
      (event) => {
        setPaneChats((prev) => {
          const paneState = prev[paneId] || { messages: [], isStreaming: false };
          const msgs = [...paneState.messages];
          msgs.push({
            role: "assistant",
            content: `Error: ${event.payload}`,
            timestamp: new Date().toISOString(),
          });
          return { ...prev, [paneId]: { messages: msgs, isStreaming: false } };
        });
      },
    );
    unlisteners.current.push(errorUnlisten);
  }, []);

  const chatInPane = useCallback(
    async (paneId: number, input: string) => {
      if (status !== "ready") return;

      // Add user message
      setPaneChats((prev) => {
        const paneState = prev[paneId] || { messages: [], isStreaming: false };
        const msgs = [...paneState.messages];
        msgs.push({
          role: "user",
          content: input,
          timestamp: new Date().toISOString(),
        });
        return { ...prev, [paneId]: { messages: msgs, isStreaming: true } };
      });

      try {
        await invoke("bridge_chat", { paneId, input });
      } catch (err) {
        setPaneChats((prev) => {
          const paneState = prev[paneId] || { messages: [], isStreaming: false };
          const msgs = [...paneState.messages];
          msgs.push({
            role: "assistant",
            content: `Error: ${err instanceof Error ? err.message : String(err)}`,
            timestamp: new Date().toISOString(),
          });
          return { ...prev, [paneId]: { messages: msgs, isStreaming: false } };
        });
      }
    },
    [status],
  );

  const assignModel = useCallback(
    async (paneId: number, modelId: string) => {
      if (status !== "ready") return;
      await invoke("bridge_assign_model", { paneId, modelId });
    },
    [status],
  );

  return {
    status,
    models,
    error,
    paneChats,
    initBridge,
    setupPaneListeners,
    chatInPane,
    assignModel,
  };
}
