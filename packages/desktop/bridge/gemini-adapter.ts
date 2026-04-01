/**
 * Gemini CLI Adapter for the desktop bridge.
 * Mirrors packages/cli/src/portal/gemini-adapter.ts
 */

import { spawn } from "node:child_process";
import {
  BaseAdapter,
  createMessage,
  type AdapterCapabilities,
  type AdapterResponse,
  type ManifoldMessage,
  type ModelConfig,
  type SendMessageOptions,
  type StreamEvent,
} from "@manifold/sdk";

interface GeminiCliAdapterOptions {
  cwd: string;
}

export class GeminiCliAdapter extends BaseAdapter {
  constructor(
    config: ModelConfig,
    private readonly options: GeminiCliAdapterOptions
  ) {
    super(config);
  }

  async initialize(): Promise<void> {
    const result = await runGeminiCommand(["--version"], this.options.cwd);
    if (result.exitCode !== 0) {
      throw new Error(
        result.stderr.trim() || "Gemini CLI is not installed or not working."
      );
    }
    this.initialized = true;
  }

  getCapabilities(): AdapterCapabilities {
    return {
      streaming: true,
      toolCalling: false,
      vision: false,
      maxContextTokens: this.config.maxContextTokens || 1000000,
      maxOutputTokens: this.config.maxOutputTokens || 8192,
    };
  }

  async sendMessage(
    messages: ManifoldMessage[],
    options?: SendMessageOptions
  ): Promise<AdapterResponse> {
    const prompt = buildPrompt(messages, options?.systemPrompt);
    const args = ["-p", prompt, "--output-format", "text"];

    const result = await runGeminiCommand(args, this.options.cwd);
    if (result.exitCode !== 0) {
      throw new Error(result.stderr.trim() || result.stdout.trim() || "Gemini CLI failed.");
    }

    return {
      message: createMessage({
        from: this.config.id, to: "user", type: "response", content: result.stdout.trim(),
      }),
      tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      finishReason: "stop",
    };
  }

  async *streamMessage(
    messages: ManifoldMessage[],
    options?: SendMessageOptions
  ): AsyncIterable<StreamEvent> {
    const prompt = buildPrompt(messages, options?.systemPrompt);
    const args = ["-p", prompt, "--output-format", "stream-json"];

    const child = spawn("gemini", args, {
      cwd: this.options.cwd,
      shell: process.platform === "win32",
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let fullContent = "";
    let buffer = "";

    const lineIterator = async function* (): AsyncIterable<string> {
      for await (const chunk of child.stdout) {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.trim()) yield line.trim();
        }
      }
      if (buffer.trim()) yield buffer.trim();
    };

    try {
      for await (const line of lineIterator()) {
        try {
          const event = JSON.parse(line);
          if (event.type === "content" && event.data?.text) {
            fullContent += event.data.text;
            yield { type: "text_delta", content: event.data.text };
          }
          if (event.type === "text_delta" && event.content) {
            fullContent += event.content;
            yield { type: "text_delta", content: event.content };
          }
          if (event.modelResponse?.candidates) {
            for (const candidate of event.modelResponse.candidates) {
              if (candidate.content?.parts) {
                for (const part of candidate.content.parts) {
                  if (part.text) {
                    const delta = part.text.slice(fullContent.length);
                    if (delta) { fullContent = part.text; yield { type: "text_delta", content: delta }; }
                  }
                }
              }
            }
          }
          if (event.type === "result" || event.type === "done") {
            const resultText = event.result || event.data?.text || "";
            if (resultText && resultText !== fullContent) {
              const delta = resultText.startsWith(fullContent) ? resultText.slice(fullContent.length) : resultText;
              if (delta) { yield { type: "text_delta", content: delta }; fullContent = resultText; }
            }
            yield { type: "message_complete", message: createMessage({ from: this.config.id, to: "user", type: "response", content: fullContent || resultText }) };
          }
        } catch { /* skip non-JSON */ }
      }
      if (fullContent) {
        yield { type: "message_complete", message: createMessage({ from: this.config.id, to: "user", type: "response", content: fullContent }) };
      }
    } catch (err) {
      yield { type: "error", error: String(err) };
    }
  }
}

function buildPrompt(messages: ManifoldMessage[], systemPrompt?: string): string {
  const transcript = messages.slice(-30).map((m) => {
    const paneTag = m.metadata.paneId ? ` pane:${m.metadata.paneId}` : "";
    return `[${m.type}${paneTag}] ${m.from} -> ${m.to}: ${m.content}`;
  }).join("\n\n");
  const sections = [
    "You are responding inside the Manifold multi-pane terminal.",
    "Use the conversation transcript below as the source of truth for this pane.",
  ];
  if (systemPrompt) sections.push(`System prompt:\n${systemPrompt}`);
  sections.push(`Transcript:\n${transcript}`);
  sections.push("Respond with the assistant message only.");
  return sections.join("\n\n");
}

async function runGeminiCommand(args: string[], cwd: string): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn("gemini", args, { cwd, shell: process.platform === "win32", windowsHide: true });
    let stdout = "", stderr = "";
    child.stdout.on("data", (c: Buffer | string) => { stdout += c.toString(); });
    child.stderr.on("data", (c: Buffer | string) => { stderr += c.toString(); });
    child.once("error", reject);
    child.once("exit", (exitCode) => { resolve({ stdout, stderr, exitCode }); });
  });
}
