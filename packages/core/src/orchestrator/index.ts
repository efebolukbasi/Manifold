/**
 * @manifold/core — Orchestrator
 *
 * The brain that routes tasks, manages model interactions,
 * and coordinates the shared context. This is the central
 * coordinator of the entire Manifold system.
 */

import { randomUUID } from "node:crypto";
import type {
  ManifoldMessage,
  ManifoldConfig,
  OrchestrationMode,
  TaskNode,
  StreamEvent,
  ToolResult,
} from "@manifold/sdk";
import {
  BaseAdapter,
  createUserMessage,
  createSystemMessage,
  createErrorMessage,
  type SendMessageOptions,
} from "@manifold/sdk";
import { MessageBus } from "../message-bus/index.js";
import { ContextManager } from "../context/index.js";
import { SessionManager } from "../session/index.js";
import { ToolRegistry } from "../tools/index.js";

export interface OrchestratorOptions {
  config: ManifoldConfig;
  projectRoot: string;
}

export class Orchestrator {
  readonly config: ManifoldConfig;
  readonly messageBus: MessageBus;
  readonly contextManager: ContextManager;
  readonly sessionManager: SessionManager;
  readonly toolRegistry: ToolRegistry;

  private adapters = new Map<string, BaseAdapter>();
  private activeModelId: string | null = null;
  private mode: OrchestrationMode;

  constructor(options: OrchestratorOptions) {
    this.config = options.config;
    this.mode = options.config.orchestration.mode;

    this.messageBus = new MessageBus();
    this.contextManager = new ContextManager();
    this.sessionManager = new SessionManager();
    this.toolRegistry = new ToolRegistry(options.projectRoot);

    // Wire up message bus to context manager
    this.messageBus.on("message", (msg: ManifoldMessage) => {
      this.contextManager.addMessage(msg);
      this.sessionManager.addMessage(msg);
    });
  }

  /**
   * Register a model adapter.
   */
  registerAdapter(id: string, adapter: BaseAdapter): void {
    this.adapters.set(id, adapter);
  }

  /**
   * Initialize all registered adapters.
   */
  async initialize(): Promise<void> {
    const initPromises: Promise<void>[] = [];

    for (const [id, adapter] of this.adapters) {
      initPromises.push(
        adapter
          .initialize()
          .then(() => {
            this.sessionManager.addActiveModel(id);
          })
          .catch((err) => {
            const errorMsg = createErrorMessage(
              "orchestrator",
              `Failed to initialize model "${id}": ${err instanceof Error ? err.message : String(err)}`
            );
            this.messageBus.publish(errorMsg);
          })
      );
    }

    await Promise.allSettled(initPromises);

    // Create a session
    this.sessionManager.createSession(
      this.config.project.name,
      this.mode
    );
  }

  /**
   * Set the active model for solo/collaborative mode.
   */
  setActiveModel(modelId: string): void {
    if (!this.adapters.has(modelId)) {
      throw new Error(`Model "${modelId}" not registered`);
    }
    this.activeModelId = modelId;
  }

  /**
   * Get the active model ID.
   */
  getActiveModel(): string | null {
    return this.activeModelId;
  }

  /**
   * Get a registered adapter by ID.
   */
  getAdapter(id: string): BaseAdapter | undefined {
    return this.adapters.get(id);
  }

  /**
   * Get all registered adapter IDs.
   */
  getModelIds(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Get all adapters that are ready.
   */
  getReadyModels(): Array<{ id: string; adapter: BaseAdapter }> {
    return Array.from(this.adapters.entries())
      .filter(([, adapter]) => adapter.isReady())
      .map(([id, adapter]) => ({ id, adapter }));
  }

  /**
   * Send a user message and get a response from the active model.
   * This is the main entry point for solo mode.
   */
  async chat(userInput: string): Promise<ManifoldMessage> {
    const targetModel = this.activeModelId;
    if (!targetModel) {
      throw new Error("No active model set. Use setActiveModel() first.");
    }

    const adapter = this.adapters.get(targetModel);
    if (!adapter || !adapter.isReady()) {
      throw new Error(`Model "${targetModel}" is not ready`);
    }

    // Create and publish user message
    const userMessage = createUserMessage(userInput, targetModel);
    this.messageBus.publish(userMessage);

    // Build context for the model
    const contextSlice = this.contextManager.buildContextSlice({
      maxMessages: 50,
    });

    // Build system prompt
    const systemPrompt = this.buildSystemPrompt(targetModel);

    // Get conversation history for this model
    const history = this.messageBus.getHistory({
      to: targetModel,
    });

    // Include messages to "all" as well
    const allMessages = this.messageBus
      .getHistory()
      .filter(
        (msg) =>
          msg.to === targetModel ||
          msg.to === "all" ||
          msg.from === targetModel
      );

    // Send to model
    const options: SendMessageOptions = {
      tools: this.toolRegistry.getAll(),
      systemPrompt,
      stream: false,
    };

    const response = await adapter.sendMessage(allMessages, options);

    // Handle tool calls
    if (response.finishReason === "tool_calls" && response.toolCalls) {
      return await this.handleToolCalls(
        targetModel,
        adapter,
        allMessages,
        response,
        options
      );
    }

    // Publish the response
    this.messageBus.publish(response.message);

    return response.message;
  }

  /**
   * Stream a response from the active model.
   */
  async *chatStream(userInput: string): AsyncIterable<StreamEvent> {
    const targetModel = this.activeModelId;
    if (!targetModel) {
      throw new Error("No active model set. Use setActiveModel() first.");
    }

    const adapter = this.adapters.get(targetModel);
    if (!adapter || !adapter.isReady()) {
      throw new Error(`Model "${targetModel}" is not ready`);
    }

    // Create and publish user message
    const userMessage = createUserMessage(userInput, targetModel);
    this.messageBus.publish(userMessage);

    // Get all relevant messages
    const allMessages = this.messageBus
      .getHistory()
      .filter(
        (msg) =>
          msg.to === targetModel ||
          msg.to === "all" ||
          msg.from === targetModel
      );

    const systemPrompt = this.buildSystemPrompt(targetModel);

    const options: SendMessageOptions = {
      tools: this.toolRegistry.getAll(),
      systemPrompt,
      stream: true,
    };

    yield* adapter.streamMessage(allMessages, options);
  }

  /**
   * Handle tool calls from a model response.
   */
  private async handleToolCalls(
    modelId: string,
    adapter: BaseAdapter,
    messages: ManifoldMessage[],
    response: ReturnType<Awaited<typeof adapter.sendMessage>> extends Promise<infer R> ? R : never,
    options: SendMessageOptions,
    depth = 0
  ): Promise<ManifoldMessage> {
    if (depth > 10) {
      const errorMsg = createErrorMessage(
        modelId,
        "Maximum tool call depth exceeded"
      );
      this.messageBus.publish(errorMsg);
      return errorMsg;
    }

    const toolResults: ToolResult[] = [];

    for (const toolCall of response.toolCalls || []) {
      const result = await this.toolRegistry.execute(
        toolCall.name,
        toolCall.arguments
      );
      toolResults.push(result);
    }

    // Send tool results back to the model
    const followUp = await adapter.sendMessage(messages, {
      ...options,
      toolResults,
    });

    // If there are more tool calls, handle them recursively
    if (followUp.finishReason === "tool_calls" && followUp.toolCalls) {
      return await this.handleToolCalls(
        modelId,
        adapter,
        messages,
        followUp,
        options,
        depth + 1
      );
    }

    // Publish the final response
    this.messageBus.publish(followUp.message);
    return followUp.message;
  }

  /**
   * Build a system prompt for a model based on its role and current context.
   */
  private buildSystemPrompt(modelId: string): string {
    const adapter = this.adapters.get(modelId);
    if (!adapter) return "";

    const role = adapter.getRole();
    const contextSummary = this.contextManager.getSummary();
    const readyModels = this.getReadyModels();
    const otherModels = readyModels
      .filter((m) => m.id !== modelId)
      .map((m) => `${m.id} (${m.adapter.getRole()})`)
      .join(", ");

    const parts = [
      `You are "${modelId}", a ${role} AI model in the Manifold multi-model terminal.`,
      `Project: ${this.config.project.name}`,
      `Orchestration mode: ${this.mode}`,
    ];

    if (otherModels) {
      parts.push(`Other active models: ${otherModels}`);
    }

    parts.push(
      `Context: ${contextSummary.fileCount} files, ${contextSummary.messageCount} messages, ${contextSummary.taskCount} tasks`
    );

    const rules = this.contextManager.getRules();
    if (rules.length > 0) {
      parts.push(`Project rules:\n${rules.map((r) => `- ${r}`).join("\n")}`);
    }

    return parts.join("\n");
  }

  /**
   * Create a new task.
   */
  createTask(title: string, assignedTo?: string): TaskNode {
    const task: TaskNode = {
      id: randomUUID(),
      title,
      status: "pending",
      assignedTo,
      createdBy: "user",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.contextManager.addTask(task);
    this.sessionManager.addTask(task);

    const announcement = createSystemMessage(
      `New task created: "${title}"${assignedTo ? ` (assigned to ${assignedTo})` : ""}`,
      "all"
    );
    this.messageBus.publish(announcement);

    return task;
  }

  /**
   * Set the orchestration mode.
   */
  setMode(mode: OrchestrationMode): void {
    this.mode = mode;
    this.sessionManager.setOrchestrationMode(mode);

    const announcement = createSystemMessage(
      `Orchestration mode changed to: ${mode}`,
      "all"
    );
    this.messageBus.publish(announcement);
  }

  /**
   * Get the current orchestration mode.
   */
  getMode(): OrchestrationMode {
    return this.mode;
  }

  /**
   * Shut down the orchestrator and clean up resources.
   */
  async shutdown(): Promise<void> {
    for (const [, adapter] of this.adapters) {
      await adapter.dispose();
    }
    this.sessionManager.endSession();
    this.messageBus.removeAllListeners();
  }
}
