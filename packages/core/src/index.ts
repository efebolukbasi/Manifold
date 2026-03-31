/**
 * @manifold/core
 *
 * The core engine package. Exports the orchestrator, context manager,
 * message bus, session manager, and tool system.
 */

export { Orchestrator, type OrchestratorOptions } from "./orchestrator/index.js";
export { ContextManager } from "./context/index.js";
export { MessageBus, type MessageHandler, type MessageFilter } from "./message-bus/index.js";
export { PaneManager } from "./panes/index.js";
export { SessionManager } from "./session/index.js";
export {
  ToolRegistry,
  FileSystemToolExecutor,
  ShellToolExecutor,
  fileSystemTools,
  shellTools,
} from "./tools/index.js";
