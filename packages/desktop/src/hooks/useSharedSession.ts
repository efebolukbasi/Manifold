import { useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  SharedSession,
  SharedSessionState,
  WorklogEntryDraft,
} from "../session";

export function useSharedSession() {
  const [sessionState, setSessionState] = useState<SharedSessionState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initializeSession = useCallback(
    async (defaultPaneCount: number, defaultActivePaneId: number) => {
      setIsLoading(true);
      setError(null);
      try {
        const nextState = await invoke<SharedSessionState>("load_shared_session", {
          defaultPaneCount,
          defaultActivePaneId,
        });
        setSessionState(nextState);
        return nextState;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const syncSession = useCallback(
    async (paneCount: number, activePaneId: number) => {
      try {
        const session = await invoke<SharedSession>("sync_shared_session", {
          paneCount,
          activePaneId,
        });
        setSessionState((prev) =>
          prev
            ? { ...prev, session }
            : { projectRoot: "", session },
        );
        return session;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw err;
      }
    },
    [],
  );

  const saveWorklogEntry = useCallback(
    async (
      input: WorklogEntryDraft,
      paneCount: number,
      activePaneId: number,
    ) => {
      setError(null);
      try {
        const session = await invoke<SharedSession>("upsert_worklog_entry", {
          input,
          paneCount,
          activePaneId,
        });
        setSessionState((prev) =>
          prev
            ? { ...prev, session }
            : { projectRoot: "", session },
        );
        return session;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw err;
      }
    },
    [],
  );

  return {
    sessionState,
    isLoading,
    error,
    initializeSession,
    syncSession,
    saveWorklogEntry,
  };
}
