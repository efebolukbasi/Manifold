/**
 * @manifold/sdk — Core type definitions
 *
 * These types form the backbone of Manifold's inter-model communication
 * and adapter system. Every adapter and core module depends on these.
 */

// ─── Model Configuration ────────────────────────────────────────────

export interface ModelConfig {
  /** Unique identifier for this model instance */
  id: string;
  /** Display name (e.g. "Claude Sonnet") */
  name: string;
  /** Role in the orchestration (architect, implementer, reviewer, executor) */
  role: ModelRole;
  /** The actual model identifier sent to the API (e.g. "claude-sonnet-4") */
  model: string;
  /** Environment variable name containing the API key */
  apiKeyEnv: string;
  /** Provider-specific configuration */
  providerConfig?: Record<string, unknown>;
  /** Max tokens for context window */
  maxContextTokens?: number;
  /** Max tokens for output */
  maxOutputTokens?: number;
}

export type ModelRole =
  | "architect"
  | "implementer"
  | "reviewer"
  | "executor"
  | "generalist";

// ─── Messages ────────────────────────────────────────────────────────

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
  /** Unique message ID */
  id: string;
  /** Sender: model ID, "user", or "orchestrator" */
  from: string;
  /** Target: model ID or "all" for broadcast */
  to: string | "all";
  /** Message type */
  type: MessageType;
  /** Message content (text) */
  content: string;
  /** Relevant context slice */
  context?: ContextSlice;
  /** Metadata */
  metadata: MessageMetadata;
  /** ISO timestamp */
  timestamp: string;
}

export interface MessageMetadata {
  taskId?: string;
  priority?: number;
  requiresResponse?: boolean;
  parentMessageId?: string;
  /** Token usage for this message */
  tokenUsage?: TokenUsage;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

// ─── Context ─────────────────────────────────────────────────────────

export interface ContextSlice {
  /** Relevant file contents or summaries */
  files?: FileContext[];
  /** Recent conversation history */
  messages?: ManifoldMessage[];
  /** Current task tree state */
  tasks?: TaskNode[];
  /** Project-level rules and constraints */
  rules?: string[];
  /** Custom key-value context */
  custom?: Record<string, unknown>;
}

export interface FileContext {
  path: string;
  content?: string;
  summary?: string;
  language?: string;
  lastModified?: string;
}

// ─── Tasks ───────────────────────────────────────────────────────────

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

// ─── Tool System ─────────────────────────────────────────────────────

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

// ─── Streaming ───────────────────────────────────────────────────────

export type StreamEvent =
  | { type: "text_delta"; content: string }
  | { type: "tool_call_start"; toolCall: ToolCall }
  | { type: "tool_call_delta"; callId: string; content: string }
  | { type: "tool_call_end"; callId: string }
  | { type: "message_complete"; message: ManifoldMessage }
  | { type: "error"; error: string };

// ─── Orchestration ───────────────────────────────────────────────────

export type OrchestrationMode =
  | "solo"
  | "collaborative"
  | "autonomous"
  | "consensus"
  | "pipeline";

// ─── Configuration ──────────────────────────────────────────────────

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
  /** Directories to exclude from file indexing */
  excludePaths?: string[];
}

// ─── Session ─────────────────────────────────────────────────────────

export interface Session {
  id: string;
  projectName: string;
  startedAt: string;
  lastActiveAt: string;
  messages: ManifoldMessage[];
  tasks: TaskNode[];
  activeModels: string[];
  orchestrationMode: OrchestrationMode;
}
