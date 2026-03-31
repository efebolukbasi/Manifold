import { useEffect, useMemo, useState, type FormEvent } from "react";
import type {
  SharedSessionState,
  WorklogEntry,
  WorklogEntryDraft,
  WorklogStatus,
} from "../session";
import type { Theme } from "../themes";

interface WorklogPanelProps {
  theme: Theme;
  activePaneId: number;
  layout: number;
  sessionState: SharedSessionState | null;
  sessionError: string | null;
  isSessionLoading: boolean;
  onSave: (draft: WorklogEntryDraft) => Promise<void>;
}

const STATUSES: WorklogStatus[] = [
  "planned",
  "in_progress",
  "blocked",
  "completed",
  "handoff",
];

interface FormState {
  id?: string;
  title: string;
  summary: string;
  status: WorklogStatus;
  nextStep: string;
  files: string;
  blockers: string;
}

function buildFormState(entry: WorklogEntry | undefined): FormState {
  return {
    id: entry?.id,
    title: entry?.title ?? "",
    summary: entry?.summary ?? "",
    status: (entry?.status as WorklogStatus | undefined) ?? "in_progress",
    nextStep: entry?.nextStep ?? "",
    files: entry?.files?.join(", ") ?? "",
    blockers: entry?.blockers?.join("\n") ?? "",
  };
}

function relativeTimestamp(timestamp: string): string {
  const value = Date.parse(timestamp);
  if (Number.isNaN(value)) {
    return timestamp;
  }

  const diffMinutes = Math.max(0, Math.round((Date.now() - value) / 60000));
  if (diffMinutes < 1) {
    return "just now";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

export function WorklogPanel({
  theme,
  activePaneId,
  layout,
  sessionState,
  sessionError,
  isSessionLoading,
  onSave,
}: WorklogPanelProps) {
  const [formState, setFormState] = useState<FormState>(buildFormState(undefined));
  const [isSaving, setIsSaving] = useState(false);

  const paneNumber = activePaneId + 1;
  const worklog = sessionState?.session.worklog ?? [];

  const paneEntry = useMemo(() => {
    const matches = worklog
      .filter((entry) => entry.paneId === paneNumber)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return matches[0];
  }, [paneNumber, worklog]);

  const recentEntries = useMemo(
    () => [...worklog].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8),
    [worklog],
  );

  useEffect(() => {
    setFormState(buildFormState(paneEntry));
  }, [paneEntry, paneNumber]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    try {
      await onSave({
        id: formState.id,
        title: formState.title,
        summary: formState.summary,
        status: formState.status,
        paneId: paneNumber,
        files: formState.files
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        blockers: formState.blockers
          .split(/\r?\n/)
          .map((value) => value.trim())
          .filter(Boolean),
        nextStep: formState.nextStep,
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <aside
      className="worklog-panel"
      style={{
        background: theme.colors.headerBg,
        borderColor: theme.colors.paneBorder,
        color: theme.colors.headerFg,
      }}
    >
      <div className="worklog-meta">
        <div>
          <span className="worklog-kicker" style={{ color: theme.colors.accent }}>
            Shared Session
          </span>
          <h2>Pane {paneNumber} checkpoint</h2>
        </div>
        <div className="worklog-project" style={{ color: theme.colors.statusFg }}>
          <span>{sessionState?.session.projectName ?? "manifold"}</span>
          <span>{layout} panes live</span>
        </div>
      </div>

      <div className="worklog-session-card" style={{ borderColor: theme.colors.paneBorder }}>
        <div>
          <span className="worklog-card-label">Session</span>
          <strong>{sessionState?.session.id.slice(0, 8) ?? "loading"}</strong>
        </div>
        <div>
          <span className="worklog-card-label">Project root</span>
          <strong>{sessionState?.projectRoot ?? "Detecting..."}</strong>
        </div>
      </div>

      <form className="worklog-form" onSubmit={handleSubmit}>
        <label>
          <span>Title</span>
          <input
            value={formState.title}
            onChange={(event) =>
              setFormState((prev) => ({ ...prev, title: event.target.value }))
            }
            placeholder="What this pane is trying to finish"
          />
        </label>

        <label>
          <span>Status</span>
          <select
            value={formState.status}
            onChange={(event) =>
              setFormState((prev) => ({
                ...prev,
                status: event.target.value as WorklogStatus,
              }))
            }
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Summary</span>
          <textarea
            rows={5}
            value={formState.summary}
            onChange={(event) =>
              setFormState((prev) => ({ ...prev, summary: event.target.value }))
            }
            placeholder="What changed, what you learned, or what another agent should know"
          />
        </label>

        <label>
          <span>Next step</span>
          <input
            value={formState.nextStep}
            onChange={(event) =>
              setFormState((prev) => ({ ...prev, nextStep: event.target.value }))
            }
            placeholder="The next concrete action"
          />
        </label>

        <label>
          <span>Files</span>
          <input
            value={formState.files}
            onChange={(event) =>
              setFormState((prev) => ({ ...prev, files: event.target.value }))
            }
            placeholder="src/App.tsx, packages/core/src/orchestrator/index.ts"
          />
        </label>

        <label>
          <span>Blockers</span>
          <textarea
            rows={3}
            value={formState.blockers}
            onChange={(event) =>
              setFormState((prev) => ({ ...prev, blockers: event.target.value }))
            }
            placeholder="One blocker per line"
          />
        </label>

        <button
          type="submit"
          className="worklog-save"
          disabled={isSaving || isSessionLoading || !formState.title.trim() || !formState.summary.trim()}
          style={{ background: theme.colors.accent, color: theme.colors.headerBg }}
        >
          {isSaving ? "Saving..." : paneEntry ? "Update checkpoint" : "Save checkpoint"}
        </button>
      </form>

      {sessionError && (
        <p className="worklog-error">{sessionError}</p>
      )}

      <div className="worklog-history">
        <div className="worklog-history-header">
          <h3>Recent shared handoffs</h3>
          <span style={{ color: theme.colors.statusFg }}>
            {recentEntries.length} entries
          </span>
        </div>

        <div className="worklog-history-list">
          {recentEntries.length === 0 && (
            <p className="worklog-empty" style={{ color: theme.colors.statusFg }}>
              No checkpoints yet. Save one from the active pane so another model can resume it later.
            </p>
          )}

          {recentEntries.map((entry) => (
            <article
              key={entry.id}
              className="worklog-entry"
              style={{ borderColor: theme.colors.paneBorder }}
            >
              <div className="worklog-entry-top">
                <strong>{entry.title}</strong>
                <span style={{ color: theme.colors.statusFg }}>
                  {relativeTimestamp(entry.updatedAt)}
                </span>
              </div>
              <div className="worklog-entry-meta" style={{ color: theme.colors.accent }}>
                pane {entry.paneId ?? "?"} • {entry.status.replace("_", " ")}
              </div>
              <p>{entry.summary}</p>
              {entry.nextStep && (
                <p className="worklog-next">
                  next: {entry.nextStep}
                </p>
              )}
            </article>
          ))}
        </div>
      </div>
    </aside>
  );
}
