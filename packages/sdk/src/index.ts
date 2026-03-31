/**
 * @manifold/sdk
 *
 * The SDK package provides all shared types, the base adapter class,
 * and message utilities that every Manifold package depends on.
 */

// Types
export type {
  ModelConfig,
  ModelRole,
  MessageType,
  ManifoldMessage,
  MessageMetadata,
  TokenUsage,
  ContextSlice,
  FileContext,
  TaskStatus,
  TaskNode,
  ToolDefinition,
  ToolParameter,
  ToolCall,
  ToolResult,
  StreamEvent,
  OrchestrationMode,
  ManifoldConfig,
  ProjectConfig,
  OrchestrationConfig,
  ToolsConfig,
  Session,
} from "./types.js";

// Adapter
export {
  BaseAdapter,
  type AdapterCapabilities,
  type SendMessageOptions,
  type AdapterResponse,
} from "./adapter.js";

// Message utilities
export {
  createMessage,
  createUserMessage,
  createSystemMessage,
  createDelegationMessage,
  createErrorMessage,
  formatMessageForDisplay,
  isUserMessage,
  isSystemMessage,
} from "./message.js";
