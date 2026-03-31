/**
 * @manifold/core - Orchestrator
 *
 * Coordinates adapters, pane state, shared context, and inter-model traffic.
 */

import { randomUUID } from "node:crypto";
import type {
  ManifoldMessage,
  ManifoldConfig,
  OrchestrationMode,
  TaskNode,
  StreamEvent,
  ToolResult,
  PaneState,
} from "@manifold/sdk";
import {
  BaseAdapter,
  createUserMessage,
  createSystemMessage,
  createErrorMessage,
  type SendMessageOptions,
  type AdapterResponse,
} from "@manifold/sdk";
import { MessageBus } from "../message-bus/index.js";
import { ContextManager } from "../context/index.js";
import { SessionManager } from "../session/index.js";
import { ToolRegistry } from "../tools/index.js";
import { PaneManager } from "../panes/index.js";

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
  readonly paneManager: PaneManager;

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
    this.paneManager = new PaneManager();

    this.messageBus.on("message", (message: ManifoldMessage) => {
      this.contextManager.addMessage(message);
      this.sessionManager.addMessage(message);
    });
  }

  registerAdapter(id: string, adapter: BaseAdapter): void {
    this.adapters.set(id, adapter);
  }

  async initialize(): Promise<void> {
    this.sessionManager.createSession(this.config.project.name, this.mode);

    const initPromises: Promise<void>[] = [];
    for (const [id, adapter] of this.adapters) {
      initPromises.push(
        adapter
          .initialize()
          .then(() => {
            this.sessionManager.addActiveModel(id);
          })
          .catch((error) => {
            const errorMessage = createErrorMessage(
              "orchestrator",
              `Failed to initialize model "${id}": ${error instanceof Error ? error.message : String(error)}`
            );
            this.messageBus.publish(errorMessage);
          })
      );
    }

    await Promise.allSettled(initPromises);

    const readyModelIds = this.getReadyModels().map((model) => model.id);
    this.paneManager.initialize(readyModelIds, this.activeModelId);
    this.activeModelId = this.paneManager.getActiveModelId();
    this.syncPaneSession();
  }

  setActiveModel(modelId: string): void {
    if (!this.adapters.has(modelId)) {
      throw new Error(`Model "${modelId}" not registered`);
    }
    this.activeModelId = modelId;
  }

  getActiveModel(): string | null {
    return this.activeModelId;
  }

  getAdapter(id: string): BaseAdapter | undefined {
    return this.adapters.get(id);
  }

  getModelIds(): string[] {
    return Array.from(this.adapters.keys());
  }

  getReadyModels(): Array<{ id: string; adapter: BaseAdapter }> {
    return Array.from(this.adapters.entries())
      .filter(([, adapter]) => adapter.isReady())
      .map(([id, adapter]) => ({ id, adapter }));
  }

  getPanes(): PaneState[] {
    return this.paneManager.getPanes();
  }

  getPaneCount(): number {
    return this.paneManager.getPaneCount();
  }

  setPaneCount(count: number): void {
    this.paneManager.setPaneCount(count);
    const activeModelId = this.paneManager.getActiveModelId();
    if (activeModelId) {
      this.activeModelId = activeModelId;
    }
    this.syncPaneSession();
  }

  getActivePaneId(): number {
    return this.paneManager.getActivePaneId();
  }

  setActivePane(paneId: number): void {
    this.paneManager.setActivePane(paneId);
    const activeModelId = this.paneManager.getActiveModelId();
    if (activeModelId) {
      this.activeModelId = activeModelId;
    }
    this.syncPaneSession();
  }

  assignModelToPane(paneId: number, modelId: string | null): void {
    if (modelId && !this.adapters.has(modelId)) {
      throw new Error(`Model "${modelId}" not registered`);
    }

    this.paneManager.assignModel(paneId, modelId);
    if (paneId === this.paneManager.getActivePaneId()) {
      this.activeModelId = modelId;
    }
    this.syncPaneSession();
  }

  getPaneMessages(paneId: number): ManifoldMessage[] {
    const pane = this.paneManager.getPane(paneId);
    if (!pane?.modelId) {
      return [];
    }

    return this.messageBus.getHistory().filter((message) => {
      if (message.to === "all") {
        return true;
      }
      return message.from === pane.modelId || message.to === pane.modelId;
    });
  }

  async chat(userInput: string): Promise<ManifoldMessage> {
    return this.chatInPane(this.paneManager.getActivePaneId(), userInput);
  }

  async chatInPane(paneId: number, userInput: string): Promise<ManifoldMessage> {
    const pane = this.paneManager.getPane(paneId);
    const targetModel = pane?.modelId;

    if (!targetModel) {
      throw new Error(`Pane ${paneId} has no assigned model.`);
    }

    this.setActivePane(paneId);
    this.paneManager.setPaneStatus(paneId, "busy");
    this.syncPaneSession();

    try {
      return await this.chatWithModel(targetModel, userInput);
    } finally {
      this.paneManager.setPaneStatus(paneId, "idle");
      this.syncPaneSession();
    }
  }

  async *chatStream(userInput: string): AsyncIterable<StreamEvent> {
    yield* this.chatStreamInPane(this.paneManager.getActivePaneId(), userInput);
  }

  async *chatStreamInPane(
    paneId: number,
    userInput: string
  ): AsyncIterable<StreamEvent> {
    const pane = this.paneManager.getPane(paneId);
    const targetModel = pane?.modelId;

    if (!targetModel) {
      throw new Error(`Pane ${paneId} has no assigned model.`);
    }

    this.setActivePane(paneId);
    this.paneManager.setPaneStatus(paneId, "busy");
    this.syncPaneSession();

    try {
      const adapter = this.adapters.get(targetModel);
      if (!adapter || !adapter.isReady()) {
        throw new Error(`Model "${targetModel}" is not ready`);
      }

      const userMessage = createUserMessage(userInput, targetModel);
      this.messageBus.publish(userMessage);

      const allMessages = this.getMessagesForModel(targetModel);
      const systemPrompt = this.buildSystemPrompt(targetModel);
      const options: SendMessageOptions = {
        tools: this.toolRegistry.getAll(),
        systemPrompt,
        stream: true,
      };

      yield* adapter.streamMessage(allMessages, options);
    } finally {
      this.paneManager.setPaneStatus(paneId, "idle");
      this.syncPaneSession();
    }
  }

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

  setMode(mode: OrchestrationMode): void {
    this.mode = mode;
    this.sessionManager.setOrchestrationMode(mode);

    const announcement = createSystemMessage(
      `Orchestration mode changed to: ${mode}`,
      "all"
    );
    this.messageBus.publish(announcement);
  }

  getMode(): OrchestrationMode {
    return this.mode;
  }

  async shutdown(): Promise<void> {
    for (const [, adapter] of this.adapters) {
      await adapter.dispose();
    }
    this.sessionManager.endSession();
    this.messageBus.removeAllListeners();
  }

  private syncPaneSession(): void {
    this.sessionManager.setPanes(this.paneManager.getPanes());
    this.sessionManager.setPaneCount(this.paneManager.getPaneCount());
    this.sessionManager.setActivePane(this.paneManager.getActivePaneId());
  }

  private getMessagesForModel(modelId: string): ManifoldMessage[] {
    return this.messageBus.getHistory().filter(
      (message) =>
        message.to === modelId ||
        message.to === "all" ||
        message.from === modelId
    );
  }

  private async chatWithModel(
    targetModel: string,
    userInput: string
  ): Promise<ManifoldMessage> {
    const adapter = this.adapters.get(targetModel);
    if (!adapter || !adapter.isReady()) {
      throw new Error(`Model "${targetModel}" is not ready`);
    }

    this.activeModelId = targetModel;

    const userMessage = createUserMessage(userInput, targetModel);
    this.messageBus.publish(userMessage);

    const allMessages = this.getMessagesForModel(targetModel);
    const systemPrompt = this.buildSystemPrompt(targetModel);
    const options: SendMessageOptions = {
      tools: this.toolRegistry.getAll(),
      systemPrompt,
      stream: false,
    };

    const response = await adapter.sendMessage(allMessages, options);
    if (response.finishReason === "tool_calls" && response.toolCalls) {
      return this.handleToolCalls(targetModel, adapter, allMessages, response, options);
    }

    this.messageBus.publish(response.message);
    return response.message;
  }

  private async handleToolCalls(
    modelId: string,
    adapter: BaseAdapter,
    messages: ManifoldMessage[],
    response: AdapterResponse,
    options: SendMessageOptions,
    depth = 0
  ): Promise<ManifoldMessage> {
    if (depth > 10) {
      const errorMessage = createErrorMessage(
        modelId,
        "Maximum tool call depth exceeded"
      );
      this.messageBus.publish(errorMessage);
      return errorMessage;
    }

    const toolResults: ToolResult[] = [];
    for (const toolCall of response.toolCalls || []) {
      const result = await this.toolRegistry.execute(
        toolCall.name,
        toolCall.arguments
      );
      toolResults.push(result);
    }

    const followUp = await adapter.sendMessage(messages, {
      ...options,
      toolResults,
    });

    if (followUp.finishReason === "tool_calls" && followUp.toolCalls) {
      return this.handleToolCalls(
        modelId,
        adapter,
        messages,
        followUp,
        options,
        depth + 1
      );
    }

    this.messageBus.publish(followUp.message);
    return followUp.message;
  }

  private buildSystemPrompt(modelId: string): string {
    const adapter = this.adapters.get(modelId);
    if (!adapter) {
      return "";
    }

    const role = adapter.getRole();
    const contextSummary = this.contextManager.getSummary();
    const readyModels = this.getReadyModels();
    const otherModels = readyModels
      .filter((model) => model.id !== modelId)
      .map((model) => `${model.id} (${model.adapter.getRole()})`)
      .join(", ");

    const visiblePanes = this.getPanes()
      .slice(0, this.getPaneCount())
      .map((pane) => `pane ${pane.id}: ${pane.modelId ?? "unassigned"} [${pane.status}]`)
      .join(", ");

    const parts = [
      `You are "${modelId}", a ${role} AI model in the Manifold multi-model terminal.`,
      `Project: ${this.config.project.name}`,
      `Orchestration mode: ${this.mode}`,
      `Pane layout: ${visiblePanes}`,
    ];

    if (otherModels) {
      parts.push(`Other active models: ${otherModels}`);
    }

    parts.push(
      `Context: ${contextSummary.fileCount} files, ${contextSummary.messageCount} messages, ${contextSummary.taskCount} tasks`
    );

    const rules = this.contextManager.getRules();
    if (rules.length > 0) {
      parts.push(`Project rules:\n${rules.map((rule) => `- ${rule}`).join("\n")}`);
    }

    return parts.join("\n");
  }
}
