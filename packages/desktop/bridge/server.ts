/**
 * @manifold/desktop — Orchestrator Bridge Server
 *
 * Node.js process that wraps @manifold/core's Orchestrator and communicates
 * with the Tauri desktop app over NDJSON (stdin/stdout).
 *
 * Protocol:
 *   Requests (stdin):  {"id":"1","action":"initialize","projectRoot":"..."}
 *   Responses (stdout): {"id":"1","event":"ready","models":[...]}
 *   Streaming (stdout): {"id":"2","event":"stream","paneId":1,"data":{...}}
 *
 * All debug/log output goes to stderr. stdout is protocol-only.
 */

import { createInterface } from "node:readline";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { Orchestrator } from "@manifold/core";
import { ClaudeAdapter } from "@manifold/adapter-claude";
import { ClaudeCliAdapter } from "./claude-adapter.js";
import { GeminiCliAdapter } from "./gemini-adapter.js";
import { CodexCliAdapter } from "./codex-adapter.js";
import type { ManifoldConfig, ModelConfig, StreamEvent } from "@manifold/sdk";
import TOML from "@iarna/toml";
import { readFile as readFileAsync } from "node:fs/promises";

// ── Redirect console to stderr ──────────────────────────────────────

const _origLog = console.log;
const _origWarn = console.warn;
const _origError = console.error;
console.log = (...args: unknown[]) => process.stderr.write(args.join(" ") + "\n");
console.warn = (...args: unknown[]) => process.stderr.write("[warn] " + args.join(" ") + "\n");
console.error = (...args: unknown[]) => process.stderr.write("[error] " + args.join(" ") + "\n");

// ── Protocol helpers ────────────────────────────────────────────────

function send(obj: Record<string, unknown>) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

function sendError(id: string, message: string) {
  send({ id, event: "error", message });
}

// ── Config loading (inlined from @manifold/cli) ─────────────────────

const DEFAULT_CONFIG: ManifoldConfig = {
  project: { name: "untitled", path: "." },
  models: {},
  orchestration: { mode: "solo", contextSharing: true, autoDelegate: false },
  tools: {
    enableFileSystem: true,
    enableShell: true,
    enableGit: false,
    enableMcp: false,
    excludePaths: ["node_modules", ".git", "dist", "build"],
  },
};

async function loadConfig(projectDir: string): Promise<ManifoldConfig> {
  const configPath = join(projectDir, "manifold.toml");

  if (existsSync(configPath)) {
    try {
      const raw = await readFileAsync(configPath, "utf-8");
      const parsed = TOML.parse(raw) as Record<string, unknown>;
      return mergeConfig(parsed, projectDir);
    } catch (error) {
      console.warn(`Failed to parse manifold.toml: ${error}`);
    }
  }

  return autoDetectConfig(projectDir);
}

function normalizeProjectRoot(projectDir: string): string {
  const trimmed = projectDir.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (process.platform === "win32" && /^[A-Za-z]:$/.test(trimmed)) {
    return `${trimmed}\\`;
  }

  return isAbsolute(trimmed) ? trimmed : resolve(trimmed);
}

async function isCommandAvailable(command: string): Promise<boolean> {
  const { spawn: spawnCmd } = await import("node:child_process");
  const checker = process.platform === "win32" ? "where" : "which";
  return new Promise((resolve) => {
    const child = spawnCmd(checker, [command], { stdio: "ignore", windowsHide: true });
    child.once("error", () => resolve(false));
    child.once("exit", (code) => resolve(code === 0));
  });
}

async function autoDetectConfig(projectDir: string): Promise<ManifoldConfig> {
  const config = { ...DEFAULT_CONFIG, models: {} as Record<string, ModelConfig> };
  config.project.path = projectDir;

  // Try to detect project name
  const pkgPath = join(projectDir, "package.json");
  if (existsSync(pkgPath)) {
    try {
      const { name } = JSON.parse(readFileSync(pkgPath, "utf-8"));
      if (name) config.project.name = name;
    } catch { /* ignore */ }
  }

  // Detect installed CLI portals
  const [hasClaude, hasGemini, hasCodex] = await Promise.all([
    isCommandAvailable("claude"),
    isCommandAvailable("gemini"),
    isCommandAvailable("codex"),
  ]);

  if (hasClaude) {
    config.models["claude-cli"] = {
      id: "claude-cli",
      name: "Claude Code",
      role: "generalist",
      model: "claude-portal-cli",
      apiKeyEnv: "CLAUDE_PORTAL_LOGIN",
      providerConfig: { transport: "portal-cli", provider: "claude" },
      maxContextTokens: 200000,
      maxOutputTokens: 16000,
    };
  }

  if (hasGemini) {
    config.models["gemini-cli"] = {
      id: "gemini-cli",
      name: "Gemini CLI",
      role: "generalist",
      model: "gemini-portal-cli",
      apiKeyEnv: "GEMINI_PORTAL_LOGIN",
      providerConfig: { transport: "portal-cli", provider: "gemini" },
      maxContextTokens: 1000000,
      maxOutputTokens: 8192,
    };
  }

  if (hasCodex) {
    config.models["codex-cli"] = {
      id: "codex-cli",
      name: "Codex",
      role: "generalist",
      model: "codex-portal-cli",
      apiKeyEnv: "CODEX_PORTAL_LOGIN",
      providerConfig: { transport: "portal-cli", provider: "codex" },
      maxContextTokens: 128000,
      maxOutputTokens: 8192,
    };
  }

  // Also detect API-key models
  if (process.env.ANTHROPIC_API_KEY) {
    config.models.claude = {
      id: "claude",
      name: "Claude",
      role: "generalist",
      model: "claude-sonnet-4-20250514",
      apiKeyEnv: "ANTHROPIC_API_KEY",
      maxContextTokens: 200000,
      maxOutputTokens: 8192,
    };
  }

  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
    config.models.gemini = {
      id: "gemini",
      name: "Gemini",
      role: "generalist",
      model: "gemini-2.5-pro",
      apiKeyEnv: process.env.GEMINI_API_KEY ? "GEMINI_API_KEY" : "GOOGLE_API_KEY",
      maxContextTokens: 1000000,
      maxOutputTokens: 8192,
    };
  }

  if (process.env.OPENAI_API_KEY) {
    config.models.openai = {
      id: "openai",
      name: "OpenAI",
      role: "generalist",
      model: "gpt-4o",
      apiKeyEnv: "OPENAI_API_KEY",
      maxContextTokens: 128000,
      maxOutputTokens: 4096,
    };
  }

  return config;
}

function mergeConfig(parsed: Record<string, unknown>, projectDir: string): ManifoldConfig {
  const config: ManifoldConfig = {
    ...DEFAULT_CONFIG,
    models: {} as Record<string, ModelConfig>,
  };

  if (parsed.project && typeof parsed.project === "object") {
    const proj = parsed.project as Record<string, unknown>;
    if (typeof proj.name === "string") config.project.name = proj.name;
    if (typeof proj.path === "string") config.project.path = proj.path;
  }

  if (parsed.models && typeof parsed.models === "object") {
    for (const [key, value] of Object.entries(
      parsed.models as Record<string, Record<string, unknown>>,
    )) {
      config.models[key] = {
        id: key,
        name: (value.name as string) || key,
        role: (value.role as ModelConfig["role"]) || "generalist",
        model: (value.model as string) || key,
        apiKeyEnv: (value.api_key_env as string) || `${key.toUpperCase()}_API_KEY`,
        maxContextTokens: value.max_context_tokens as number | undefined,
        maxOutputTokens: value.max_output_tokens as number | undefined,
        providerConfig: value.provider_config as Record<string, unknown> | undefined,
      };
    }
  }

  if (parsed.orchestration && typeof parsed.orchestration === "object") {
    const orch = parsed.orchestration as Record<string, unknown>;
    if (typeof orch.mode === "string")
      config.orchestration.mode = orch.mode as ManifoldConfig["orchestration"]["mode"];
    if (typeof orch.context_sharing === "boolean")
      config.orchestration.contextSharing = orch.context_sharing;
    if (typeof orch.auto_delegate === "boolean")
      config.orchestration.autoDelegate = orch.auto_delegate;
  }

  return config;
}

function detectProvider(id: string, config: ModelConfig): string {
  const m = config.model.toLowerCase();
  if (m.includes("claude") || config.apiKeyEnv.includes("ANTHROPIC")) return "claude";
  if (m.includes("gemini") || config.apiKeyEnv.includes("GEMINI") || config.apiKeyEnv.includes("GOOGLE")) return "gemini";
  if (m.includes("gpt") || m.includes("o1") || m.includes("codex")) return "openai";
  return id;
}

function createAdapter(id: string, modelConfig: ModelConfig, projectRoot: string) {
  // Portal CLI adapters (detected CLIs, no API key needed)
  if (modelConfig.providerConfig?.transport === "portal-cli") {
    switch (modelConfig.providerConfig.provider) {
      case "claude":
        return new ClaudeCliAdapter(modelConfig, { cwd: projectRoot });
      case "gemini":
        return new GeminiCliAdapter(modelConfig, { cwd: projectRoot });
      case "codex":
        return new CodexCliAdapter(modelConfig, { cwd: projectRoot });
      default:
        console.warn(`No portal adapter for "${id}". Skipping.`);
        return null;
    }
  }

  // SDK-based adapters (require API keys)
  const provider = detectProvider(id, modelConfig);
  switch (provider) {
    case "claude":
      return new ClaudeAdapter(modelConfig);
    default:
      console.warn(`No adapter for "${id}" (provider: ${provider}). Skipping.`);
      return null;
  }
}

// ── State ───────────────────────────────────────────────────────────

let orchestrator: Orchestrator | null = null;

// ── Action handlers ─────────────────────────────────────────────────

async function handleInitialize(id: string, payload: Record<string, unknown>) {
  const projectRoot = normalizeProjectRoot((payload.projectRoot as string) || "");
  if (!projectRoot) {
    sendError(id, "projectRoot is required");
    return;
  }

  try {
    const config = await loadConfig(projectRoot);

    if (Object.keys(config.models).length === 0) {
      sendError(id, "No AI models detected. Set an API key (ANTHROPIC_API_KEY, etc.) or create a manifold.toml.");
      return;
    }

    orchestrator = new Orchestrator({ config, projectRoot });

    for (const [modelId, modelConfig] of Object.entries(config.models)) {
      const adapter = createAdapter(modelId, modelConfig, projectRoot);
      if (adapter) {
        orchestrator.registerAdapter(modelId, adapter);
      }
    }

    await orchestrator.initialize();

    const readyModels = orchestrator.getReadyModels();
    if (readyModels.length > 0) {
      orchestrator.setActiveModel(readyModels[0].id);
    }

    const models = readyModels.map((m) => ({
      id: m.id,
      name: m.adapter.getDisplayName(),
    }));

    const panes = orchestrator.paneManager.getPanes();

    send({
      id,
      event: "ready",
      models,
      panes,
      sessionId: orchestrator.sessionManager.getCurrentSession()?.id,
    });

    console.log(`Bridge initialized with ${models.length} model(s)`);
  } catch (err) {
    sendError(id, `Initialization failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function handleChat(id: string, payload: Record<string, unknown>) {
  if (!orchestrator) {
    sendError(id, "Bridge not initialized");
    return;
  }

  const paneId = payload.paneId as number;
  const input = payload.input as string;

  if (!paneId || !input) {
    sendError(id, "paneId and input are required");
    return;
  }

  try {
    const stream = orchestrator.chatStreamInPane(paneId, input);
    for await (const event of stream) {
      send({ id, event: "stream", paneId, data: event });
    }
    send({ id, event: "stream_end", paneId });
  } catch (err) {
    sendError(id, `Chat error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function handleGetStatus(id: string) {
  if (!orchestrator) {
    sendError(id, "Bridge not initialized");
    return;
  }

  const readyModels = orchestrator.getReadyModels().map((m) => ({
    id: m.id,
    name: m.adapter.getDisplayName(),
  }));

  send({
    id,
    event: "status",
    models: readyModels,
    panes: orchestrator.paneManager.getPanes(),
    sessionId: orchestrator.sessionManager.getCurrentSession()?.id,
  });
}

function handleAssignModel(id: string, payload: Record<string, unknown>) {
  if (!orchestrator) {
    sendError(id, "Bridge not initialized");
    return;
  }

  const paneId = payload.paneId as number;
  const modelId = (payload.modelId as string) || null;

  orchestrator.assignModelToPane(paneId, modelId);
  send({ id, event: "ok" });
}

async function handleShutdown(id: string) {
  if (orchestrator) {
    await orchestrator.shutdown();
    orchestrator = null;
  }
  send({ id, event: "ok" });
  process.exit(0);
}

// ── Main loop ───────────────────────────────────────────────────────

const rl = createInterface({ input: process.stdin });

rl.on("line", async (line) => {
  let msg: Record<string, unknown>;
  try {
    msg = JSON.parse(line);
  } catch {
    console.error(`Invalid JSON: ${line}`);
    return;
  }

  const id = msg.id as string;
  const action = msg.action as string;

  if (!id || !action) {
    console.error(`Missing id or action in message: ${line}`);
    return;
  }

  try {
    switch (action) {
      case "initialize":
        await handleInitialize(id, msg);
        break;
      case "chat":
        await handleChat(id, msg);
        break;
      case "get_status":
        handleGetStatus(id);
        break;
      case "assign_model":
        handleAssignModel(id, msg);
        break;
      case "shutdown":
        await handleShutdown(id);
        break;
      default:
        sendError(id, `Unknown action: ${action}`);
    }
  } catch (err) {
    sendError(id, `Unhandled error: ${err instanceof Error ? err.message : String(err)}`);
  }
});

rl.on("close", () => {
  console.log("stdin closed, shutting down bridge");
  if (orchestrator) {
    orchestrator.shutdown().catch(() => {});
  }
  process.exit(0);
});

console.log("Manifold bridge server started, waiting for commands...");
