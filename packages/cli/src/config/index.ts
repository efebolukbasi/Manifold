/**
 * @manifold/cli — Configuration Loader
 *
 * Loads and validates the manifold.toml configuration file.
 * Falls back to sensible defaults when no config is found.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import TOML from "@iarna/toml";
import type { ManifoldConfig, ModelConfig, OrchestrationMode } from "@manifold/sdk";

const DEFAULT_CONFIG: ManifoldConfig = {
  project: {
    name: "untitled",
    path: ".",
  },
  models: {},
  orchestration: {
    mode: "solo",
    contextSharing: true,
    autoDelegate: false,
  },
  tools: {
    enableFileSystem: true,
    enableShell: true,
    enableGit: false,
    enableMcp: false,
    excludePaths: ["node_modules", ".git", "dist", "build"],
  },
};

/**
 * Load configuration from manifold.toml in the given directory.
 * If no config file exists, returns defaults with auto-detected models.
 */
export async function loadConfig(projectDir: string): Promise<ManifoldConfig> {
  const configPath = join(projectDir, "manifold.toml");

  if (!existsSync(configPath)) {
    return autoDetectConfig(projectDir);
  }

  try {
    const raw = await readFile(configPath, "utf-8");
    const parsed = TOML.parse(raw) as Record<string, unknown>;
    return mergeConfig(parsed);
  } catch (error) {
    console.error(
      `Warning: Failed to parse manifold.toml: ${error instanceof Error ? error.message : String(error)}`
    );
    return autoDetectConfig(projectDir);
  }
}

/**
 * Auto-detect available models based on environment variables.
 */
function autoDetectConfig(projectDir: string): ManifoldConfig {
  const config = { ...DEFAULT_CONFIG };
  config.project.path = projectDir;

  // Try to detect project name from package.json
  const pkgPath = join(projectDir, "package.json");
  if (existsSync(pkgPath)) {
    try {
      // We'll read it synchronously for simplicity in detection
      const { name } = JSON.parse(
        require("node:fs").readFileSync(pkgPath, "utf-8")
      );
      if (name) config.project.name = name;
    } catch {
      // Ignore
    }
  }

  const models: Record<string, ModelConfig> = {};

  // Detect Claude
  if (process.env.ANTHROPIC_API_KEY) {
    models.claude = {
      id: "claude",
      name: "Claude",
      role: "generalist",
      model: "claude-sonnet-4-20250514",
      apiKeyEnv: "ANTHROPIC_API_KEY",
      maxContextTokens: 200000,
      maxOutputTokens: 8192,
    };
  }

  // Detect Gemini
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
    models.gemini = {
      id: "gemini",
      name: "Gemini",
      role: "generalist",
      model: "gemini-2.5-pro",
      apiKeyEnv: process.env.GEMINI_API_KEY ? "GEMINI_API_KEY" : "GOOGLE_API_KEY",
      maxContextTokens: 1000000,
      maxOutputTokens: 8192,
    };
  }

  // Detect OpenAI
  if (process.env.OPENAI_API_KEY) {
    models.openai = {
      id: "openai",
      name: "OpenAI",
      role: "generalist",
      model: "gpt-4o",
      apiKeyEnv: "OPENAI_API_KEY",
      maxContextTokens: 128000,
      maxOutputTokens: 4096,
    };
  }

  config.models = models;
  return config;
}

/**
 * Merge parsed TOML config with defaults.
 */
function mergeConfig(parsed: Record<string, unknown>): ManifoldConfig {
  const config = { ...DEFAULT_CONFIG };

  // Project
  if (parsed.project && typeof parsed.project === "object") {
    const proj = parsed.project as Record<string, unknown>;
    if (typeof proj.name === "string") config.project.name = proj.name;
    if (typeof proj.path === "string") config.project.path = proj.path;
  }

  // Models
  if (parsed.models && typeof parsed.models === "object") {
    const models: Record<string, ModelConfig> = {};
    for (const [key, value] of Object.entries(
      parsed.models as Record<string, Record<string, unknown>>
    )) {
      models[key] = {
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
    config.models = models;
  }

  // Orchestration
  if (parsed.orchestration && typeof parsed.orchestration === "object") {
    const orch = parsed.orchestration as Record<string, unknown>;
    if (typeof orch.mode === "string")
      config.orchestration.mode = orch.mode as OrchestrationMode;
    if (typeof orch.context_sharing === "boolean")
      config.orchestration.contextSharing = orch.context_sharing;
    if (typeof orch.auto_delegate === "boolean")
      config.orchestration.autoDelegate = orch.auto_delegate;
  }

  // Tools
  if (parsed.tools && typeof parsed.tools === "object") {
    const tools = parsed.tools as Record<string, unknown>;
    config.tools = {
      enableFileSystem: tools.enable_file_system as boolean ?? true,
      enableShell: tools.enable_shell as boolean ?? true,
      enableGit: tools.enable_git as boolean ?? false,
      enableMcp: tools.enable_mcp as boolean ?? false,
      excludePaths: tools.exclude_paths as string[] ?? DEFAULT_CONFIG.tools!.excludePaths,
    };
  }

  return config;
}
