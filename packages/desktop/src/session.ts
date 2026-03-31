export type WorklogStatus =
  | "planned"
  | "in_progress"
  | "blocked"
  | "completed"
  | "handoff";

export interface SharedPaneState {
  id: number;
  modelId: string | null;
  status: string;
  lastActiveAt: string;
}

export interface WorklogEntry {
  id: string;
  title: string;
  summary: string;
  status: string;
  createdBy: string;
  modelId?: string | null;
  paneId?: number | null;
  taskId?: string | null;
  files?: string[] | null;
  blockers?: string[] | null;
  nextStep?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SharedSession {
  id: string;
  projectName: string;
  startedAt: string;
  lastActiveAt: string;
  messages: unknown[];
  tasks: unknown[];
  worklog: WorklogEntry[];
  activeModels: string[];
  orchestrationMode: string;
  panes: SharedPaneState[];
  paneCount: number;
  activePaneId: number;
}

export interface SharedSessionState {
  session: SharedSession;
  projectRoot: string;
}

export interface WorklogEntryDraft {
  id?: string;
  title: string;
  summary: string;
  status: WorklogStatus;
  paneId: number;
  createdBy?: string;
  modelId?: string;
  taskId?: string;
  files?: string[];
  blockers?: string[];
  nextStep?: string;
}

// ── Bridge / Chat types ─────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface BridgeModel {
  id: string;
  name: string;
}

export type StreamEventData =
  | { type: "text_delta"; content: string }
  | { type: "tool_call_start"; toolCall: unknown }
  | { type: "tool_call_delta"; callId: string; content: string }
  | { type: "tool_call_end"; callId: string }
  | { type: "message_complete"; message: unknown }
  | { type: "error"; error: string };
