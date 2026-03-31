/**
 * @manifold/adapter-claude — Adapter Implementation
 *
 * Implements the BaseAdapter interface for Claude (Anthropic).
 */

import {
  BaseAdapter,
  type AdapterCapabilities,
  type AdapterResponse,
  type SendMessageOptions,
  type ManifoldMessage,
  type StreamEvent,
  createMessage,
} from "@manifold/sdk";
import { ClaudeClient } from "./client.js";

export class ClaudeAdapter extends BaseAdapter {
  private client!: ClaudeClient;

  async initialize(): Promise<void> {
    const apiKey = this.getApiKey();
    this.client = new ClaudeClient(apiKey);
    this.initialized = true;
  }

  getCapabilities(): AdapterCapabilities {
    // Defaults for Claude Sonnet; could be model-specific
    return {
      streaming: true,
      toolCalling: true,
      vision: true,
      maxContextTokens: this.config.maxContextTokens || 200000,
      maxOutputTokens: this.config.maxOutputTokens || 8192,
    };
  }

  async sendMessage(
    messages: ManifoldMessage[],
    options?: SendMessageOptions
  ): Promise<AdapterResponse> {
    const convertedMessages = this.client.convertMessages(messages);
    const tools = options?.tools
      ? this.client.convertTools(options.tools)
      : undefined;

    const result = await this.client.sendMessage({
      model: this.config.model,
      messages: convertedMessages,
      system: options?.systemPrompt,
      tools,
      toolResults: options?.toolResults,
      maxTokens: options?.maxTokens || this.config.maxOutputTokens,
      temperature: options?.temperature,
    });

    const responseMessage = createMessage({
      from: this.config.id,
      to: "user",
      type: "response",
      content: result.content,
    });

    return {
      message: responseMessage,
      tokenUsage: {
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        totalTokens: result.inputTokens + result.outputTokens,
      },
      toolCalls:
        result.toolCalls.length > 0 ? result.toolCalls : undefined,
      finishReason:
        result.stopReason === "tool_use"
          ? "tool_calls"
          : result.stopReason === "max_tokens"
            ? "max_tokens"
            : "stop",
    };
  }

  async *streamMessage(
    messages: ManifoldMessage[],
    options?: SendMessageOptions
  ): AsyncIterable<StreamEvent> {
    const convertedMessages = this.client.convertMessages(messages);
    const tools = options?.tools
      ? this.client.convertTools(options.tools)
      : undefined;

    yield* this.client.streamMessage({
      model: this.config.model,
      messages: convertedMessages,
      system: options?.systemPrompt,
      tools,
      maxTokens: options?.maxTokens || this.config.maxOutputTokens,
      temperature: options?.temperature,
      signal: options?.signal,
    });
  }
}
