/**
 * @manifold/sdk — Base Adapter
 *
 * Abstract base class that all model adapters must implement.
 * Handles the translation between Manifold's internal protocol
 * and each model provider's API.
 */

import type {
  ModelConfig,
  ManifoldMessage,
  ToolDefinition,
  ToolResult,
  StreamEvent,
  TokenUsage,
} from "./types.js";

// ─── Adapter Interface ──────────────────────────────────────────────

export interface AdapterCapabilities {
  /** Whether the model supports streaming responses */
  streaming: boolean;
  /** Whether the model supports tool/function calling */
  toolCalling: boolean;
  /** Whether the model supports vision/image inputs */
  vision: boolean;
  /** Maximum context window size in tokens */
  maxContextTokens: number;
  /** Maximum output tokens */
  maxOutputTokens: number;
}

export interface SendMessageOptions {
  /** Available tools the model can call */
  tools?: ToolDefinition[];
  /** Results from previous tool calls */
  toolResults?: ToolResult[];
  /** System prompt to prepend */
  systemPrompt?: string;
  /** Temperature (0-1) */
  temperature?: number;
  /** Max tokens for this specific request */
  maxTokens?: number;
  /** Whether to stream the response */
  stream?: boolean;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

export interface AdapterResponse {
  message: ManifoldMessage;
  tokenUsage: TokenUsage;
  /** Any tool calls the model wants to make */
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
  /** Whether the model finished or was cut off */
  finishReason: "stop" | "tool_calls" | "max_tokens" | "error";
}

// ─── Base Adapter Class ─────────────────────────────────────────────

export abstract class BaseAdapter {
  readonly config: ModelConfig;
  protected initialized = false;

  constructor(config: ModelConfig) {
    this.config = config;
  }

  /** Initialize the adapter (validate API key, set up client, etc.) */
  abstract initialize(): Promise<void>;

  /** Get this adapter's capabilities */
  abstract getCapabilities(): AdapterCapabilities;

  /** Send a message and get a complete response */
  abstract sendMessage(
    messages: ManifoldMessage[],
    options?: SendMessageOptions
  ): Promise<AdapterResponse>;

  /** Send a message and stream the response */
  abstract streamMessage(
    messages: ManifoldMessage[],
    options?: SendMessageOptions
  ): AsyncIterable<StreamEvent>;

  /** Check if the adapter is ready to use */
  isReady(): boolean {
    return this.initialized;
  }

  /** Get the model's display name */
  getDisplayName(): string {
    return this.config.name || this.config.model;
  }

  /** Get the model's role */
  getRole(): string {
    return this.config.role;
  }

  /** Validate that the API key environment variable is set */
  protected getApiKey(): string {
    const key = process.env[this.config.apiKeyEnv];
    if (!key) {
      throw new Error(
        `API key not found. Set the ${this.config.apiKeyEnv} environment variable.`
      );
    }
    return key;
  }

  /** Clean up resources */
  async dispose(): Promise<void> {
    this.initialized = false;
  }
}
