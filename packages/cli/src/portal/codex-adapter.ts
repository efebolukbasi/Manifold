import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
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

interface CodexCliAdapterOptions {
  cwd: string;
}

export class CodexCliAdapter extends BaseAdapter {
  constructor(
    config: ModelConfig,
    private readonly options: CodexCliAdapterOptions
  ) {
    super(config);
  }

  async initialize(): Promise<void> {
    const result = await runCodexCommand(["login", "status"], this.options.cwd);
    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    if (!combinedOutput.includes("Logged in")) {
      throw new Error(
        result.stderr.trim() || result.stdout.trim() || "Codex CLI is not logged in."
      );
    }

    this.initialized = true;
  }

  getCapabilities(): AdapterCapabilities {
    return {
      streaming: false,
      toolCalling: false,
      vision: false,
      maxContextTokens: this.config.maxContextTokens || 128000,
      maxOutputTokens: this.config.maxOutputTokens || 8192,
    };
  }

  async sendMessage(
    messages: ManifoldMessage[],
    options?: SendMessageOptions
  ): Promise<AdapterResponse> {
    const tempDir = await mkdtemp(join(tmpdir(), "manifold-codex-"));
    const outputFile = join(tempDir, "last-message.txt");
    const prompt = buildCodexPrompt(messages, options?.systemPrompt);

    try {
      const result = await runCodexCommand(
        [
          "exec",
          "--full-auto",
          "--color",
          "never",
          "--ephemeral",
          "-C",
          this.options.cwd,
          "-o",
          outputFile,
          "-",
        ],
        this.options.cwd,
        prompt
      );

      if (result.exitCode !== 0) {
        throw new Error(result.stderr.trim() || result.stdout.trim() || "Codex exec failed.");
      }

      const content = (await readFile(outputFile, "utf-8")).trim();
      if (!content) {
        throw new Error("Codex did not return a final message.");
      }

      return {
        message: createMessage({
          from: this.config.id,
          to: "user",
          type: "response",
          content,
        }),
        tokenUsage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
        },
        finishReason: "stop",
      };
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  async *streamMessage(
    messages: ManifoldMessage[],
    options?: SendMessageOptions
  ): AsyncIterable<StreamEvent> {
    const response = await this.sendMessage(messages, options);
    yield { type: "text_delta", content: response.message.content };
    yield { type: "message_complete", message: response.message };
  }
}

function buildCodexPrompt(
  messages: ManifoldMessage[],
  systemPrompt?: string
): string {
  const transcript = messages
    .slice(-30)
    .map((message) => {
      const paneTag = message.metadata.paneId ? ` pane:${message.metadata.paneId}` : "";
      return `[${message.type}${paneTag}] ${message.from} -> ${message.to}: ${message.content}`;
    })
    .join("\n\n");

  const sections = [
    "You are responding inside the Manifold multi-pane terminal.",
    "Use the conversation transcript below as the source of truth for this pane.",
  ];

  if (systemPrompt) {
    sections.push(`System prompt:\n${systemPrompt}`);
  }

  sections.push(`Transcript:\n${transcript}`);
  sections.push("Respond with the assistant message only.");

  return sections.join("\n\n");
}

async function runCodexCommand(
  args: string[],
  cwd: string,
  stdin?: string
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn("codex", args, {
      cwd,
      shell: process.platform === "win32",
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.once("error", reject);
    child.once("exit", (exitCode) => {
      resolve({ stdout, stderr, exitCode });
    });

    if (stdin && child.stdin) {
      child.stdin.write(stdin);
      child.stdin.end();
    }
  });
}
