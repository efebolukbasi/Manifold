/**
 * @manifold/adapter-claude — Anthropic API Client
 *
 * Thin wrapper around the Anthropic SDK that handles
 * the translation between Manifold's message format
 * and the Anthropic API format.
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  ManifoldMessage,
  ToolDefinition,
  ToolResult,
  StreamEvent,
} from "@manifold/sdk";

// ─── Type Mappings ──────────────────────────────────────────────────

type AnthropicRole = "user" | "assistant";

interface AnthropicMessage {
  role: AnthropicRole;
  content: string | AnthropicContentBlock[];
}

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// ─── Client ──────────────────────────────────────────────────────────

export class ClaudeClient {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  /**
   * Convert Manifold messages to Anthropic format.
   */
  convertMessages(messages: ManifoldMessage[]): AnthropicMessage[] {
    const result: AnthropicMessage[] = [];

    for (const msg of messages) {
      // Skip system messages (handled separately)
      if (msg.type === "system") continue;

      const role: AnthropicRole =
        msg.from === "user" || msg.type === "query" || msg.type === "delegate"
          ? "user"
          : "assistant";

      // Merge consecutive messages with the same role
      const last = result[result.length - 1];
      if (last && last.role === role) {
        const prefix =
          msg.from !== "user" ? `[${msg.from}] ` : "";
        if (typeof last.content === "string") {
          last.content = `${last.content}\n\n${prefix}${msg.content}`;
        }
      } else {
        const prefix =
          role === "user" && msg.from !== "user" ? `[${msg.from}] ` : "";
        result.push({
          role,
          content: `${prefix}${msg.content}`,
        });
      }
    }

    // Ensure we start with a user message (Anthropic requirement)
    if (result.length > 0 && result[0].role !== "user") {
      result.unshift({ role: "user", content: "(session start)" });
    }

    // Ensure we don't end with an assistant message when sending
    // (the API will generate the next assistant message)

    return result;
  }

  /**
   * Convert Manifold tool definitions to Anthropic format.
   */
  convertTools(tools: ToolDefinition[]): AnthropicTool[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: "object" as const,
        properties: Object.fromEntries(
          Object.entries(tool.parameters).map(([key, param]) => [
            key,
            {
              type: param.type,
              description: param.description,
              ...(param.enum ? { enum: param.enum } : {}),
            },
          ])
        ),
        required: tool.required,
      },
    }));
  }

  /**
   * Send a message to Claude and get a complete response.
   */
  async sendMessage(params: {
    model: string;
    messages: AnthropicMessage[];
    system?: string;
    tools?: AnthropicTool[];
    toolResults?: ToolResult[];
    maxTokens?: number;
    temperature?: number;
  }): Promise<{
    content: string;
    toolCalls: Array<{
      id: string;
      name: string;
      arguments: Record<string, unknown>;
    }>;
    inputTokens: number;
    outputTokens: number;
    stopReason: string;
  }> {
    // If we have tool results, add them as the last user message
    const messages = [...params.messages];
    if (params.toolResults && params.toolResults.length > 0) {
      const toolResultBlocks: AnthropicContentBlock[] = params.toolResults.map(
        (result) => ({
          type: "tool_result" as const,
          tool_use_id: result.callId,
          content: result.result,
          is_error: result.isError,
        })
      );
      messages.push({
        role: "user",
        content: toolResultBlocks,
      });
    }

    const response = await this.client.messages.create({
      model: params.model,
      max_tokens: params.maxTokens || 4096,
      system: params.system,
      messages: messages as Anthropic.MessageParam[],
      tools: params.tools as Anthropic.Tool[],
      temperature: params.temperature,
    });

    // Extract text content and tool calls
    let textContent = "";
    const toolCalls: Array<{
      id: string;
      name: string;
      arguments: Record<string, unknown>;
    }> = [];

    for (const block of response.content) {
      if (block.type === "text") {
        textContent += block.text;
      } else if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: block.input as Record<string, unknown>,
        });
      }
    }

    return {
      content: textContent,
      toolCalls,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      stopReason: response.stop_reason || "end_turn",
    };
  }

  /**
   * Stream a message from Claude.
   */
  async *streamMessage(params: {
    model: string;
    messages: AnthropicMessage[];
    system?: string;
    tools?: AnthropicTool[];
    maxTokens?: number;
    temperature?: number;
    signal?: AbortSignal;
  }): AsyncIterable<StreamEvent> {
    const stream = this.client.messages.stream({
      model: params.model,
      max_tokens: params.maxTokens || 4096,
      system: params.system,
      messages: params.messages as Anthropic.MessageParam[],
      tools: params.tools as Anthropic.Tool[],
      temperature: params.temperature,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta") {
        const delta = event.delta as { type: string; text?: string };
        if (delta.type === "text_delta" && delta.text) {
          yield { type: "text_delta", content: delta.text };
        }
      }
    }
  }
}
