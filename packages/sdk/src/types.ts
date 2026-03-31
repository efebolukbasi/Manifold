/**
 * @manifold/sdk - Core type definitions
 *
 * These types form the backbone of Manifold's inter-model communication
 * and adapter system. Every adapter and core module depends on these.
 */

export interface ModelConfig {
  id: string;
  name: string;
  role: ModelRole;
  model: string;
  apiKeyEnv: string;
  providerConfig?: Record<string, unknown>;
  maxContextTokens?: number;
  maxOutputTokens?: number;
}

export type ModelRole =
  | "architect"
  | "implementer"
  | "reviewer"
  | "executor"
  | "generalist";

export type MessageType =
  | "query"
  | "response"
  | "delegate"
  | "broadcast"
  | "vote"
  | "tool_call"
  | "tool_result"
  | "system"
  | "error";

export interface ManifoldMessage {
  id: string;
  from: string;
  to: string | "all";
  type: MessageType;
  content: string;
  context?: ContextSlice;
  metadata: MessageMetadata;
  timestamp: string;
}

export interface MessageMetadata {
  paneId?: number;
  taskId?: string;
  priority?: number;
  requiresResponse?: boolean;
  parentMessageId?: string;
  tokenUsage?: TokenUsage;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ContextSlice {
  files?: FileContext[];
  messages?: ManifoldMessage[];
  tasks?: TaskNode[];
  worklog?: WorklogEntry[];
  rules?: string[];
  custom?: Record<string, unknown>;
}

export interface FileContext {
  path: string;
  content?: string;
  summary?: string;
  language?: string;
  lastModified?: string;
}

export type TaskStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "cancelled";

export interface TaskNode {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  assignedTo?: string;
  createdBy: string;
  subtasks?: TaskNode[];
  result?: string;
  createdAt: string;
  updatedAt: string;
}

export type WorklogStatus =
  | "planned"
  | "in_progress"
  | "blocked"
  | "completed"
  | "handoff";

export interface WorklogEntry {
  id: string;
  title: string;
  summary: string;
  status: WorklogStatus;
  createdBy: string;
  modelId?: string;
  paneId?: number;
  taskId?: string;
  files?: string[];
  blockers?: string[];
  nextStep?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, ToolParameter>;
  required?: string[];
}

export interface ToolParameter {
  type: "string" | "number" | "boolean" | "array" | "object";
  description: string;
  enum?: string[];
  default?: unknown;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  callId: string;
  name: string;
  result: string;
  isError?: boolean;
}

export type StreamEvent =
  | { type: "text_delta"; content: string }
  | { type: "tool_call_start"; toolCall: ToolCall }
  | { type: "tool_call_delta"; callId: string; content: string }
  | { type: "tool_call_end"; callId: string }
  | { type: "message_complete"; message: ManifoldMessage }
  | { type: "error"; error: string };

export type OrchestrationMode =
  | "solo"
  | "collaborative"
  | "autonomous"
  | "consensus"
  | "pipeline";

export interface ManifoldConfig {
  project: ProjectConfig;
  models: Record<string, ModelConfig>;
  orchestration: OrchestrationConfig;
  tools?: ToolsConfig;
}

export interface ProjectConfig {
  name: string;
  path: string;
}

export interface OrchestrationConfig {
  mode: OrchestrationMode;
  contextSharing: boolean;
  autoDelegate: boolean;
}

export interface ToolsConfig {
  enableFileSystem?: boolean;
  enableShell?: boolean;
  enableGit?: boolean;
  enableMcp?: boolean;
  excludePaths?: string[];
}

export type PaneStatus = "idle" | "busy";

export interface PaneState {
  id: number;
  modelId: string | null;
  status: PaneStatus;
  lastActiveAt: string;
}

export interface Session {
  id: string;
  projectName: string;
  startedAt: string;
  lastActiveAt: string;
  messages: ManifoldMessage[];
  tasks: TaskNode[];
  worklog: WorklogEntry[];
  activeModels: string[];
  orchestrationMode: OrchestrationMode;
  panes: PaneState[];
  paneCount: number;
  activePaneId: number;
}
