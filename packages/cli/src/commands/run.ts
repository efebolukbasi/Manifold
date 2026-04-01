/**
 * @manifold/cli - Run Command
 *
 * The main `manifold run` command that starts the interactive TUI.
 */

import React from "react";
import { render } from "ink";
import { Orchestrator } from "@manifold/core";
import { ClaudeAdapter } from "@manifold/adapter-claude";
import type { ManifoldConfig, ModelConfig } from "@manifold/sdk";
import { App } from "../ui/App.js";
import { loadConfig } from "../config/index.js";
import { CodexCliAdapter } from "../portal/codex-adapter.js";
import { ClaudeCliAdapter } from "../portal/claude-adapter.js";
import { GeminiCliAdapter } from "../portal/gemini-adapter.js";
import {
  buildEmbeddedPortalModels,
  detectInstalledPortalProviders,
  getPortalProvider,
  launchPortalSession,
  selectPortalProvider,
  supportsEmbeddedPortalProvider,
} from "../portal/index.js";

/**
 * Create the appropriate adapter for a model config.
 */
function createAdapter(id: string, config: ModelConfig, projectDir: string) {
  if (config.providerConfig?.transport === "portal-cli") {
    switch (config.providerConfig.provider) {
      case "codex":
        return new CodexCliAdapter(config, { cwd: projectDir });
      case "claude":
        return new ClaudeCliAdapter(config, { cwd: projectDir });
      case "gemini":
        return new GeminiCliAdapter(config, { cwd: projectDir });
      default:
        console.warn(`No embedded portal adapter available for "${id}". Skipping.`);
        return null;
    }
  }

  const provider = detectProvider(id, config);

  switch (provider) {
    case "claude":
      return new ClaudeAdapter(config);
    default:
      console.warn(`No adapter available for "${id}" (provider: ${provider}). Skipping.`);
      return null;
  }
}

/**
 * Detect the provider from the model ID or model name.
 */
function detectProvider(id: string, config: ModelConfig): string {
  const modelLower = config.model.toLowerCase();
  if (modelLower.includes("claude") || config.apiKeyEnv.includes("ANTHROPIC")) {
    return "claude";
  }
  if (
    modelLower.includes("gemini") ||
    config.apiKeyEnv.includes("GEMINI") ||
    config.apiKeyEnv.includes("GOOGLE")
  ) {
    return "gemini";
  }
  if (
    modelLower.includes("gpt") ||
    modelLower.includes("o1") ||
    modelLower.includes("codex")
  ) {
    return "openai";
  }
  return id;
}

export interface RunOptions {
  model?: string;
  mode?: string;
  config?: string;
}

export async function runCommand(options: RunOptions): Promise<void> {
  const projectDir = process.cwd();
  const config = await loadConfig(projectDir);
  const installedPortalProviders = await detectInstalledPortalProviders();
  const embeddedPortalModels = buildEmbeddedPortalModels(installedPortalProviders);
  config.models = {
    ...embeddedPortalModels,
    ...config.models,
  };
  const requestedPortalProvider = options.model
    ? getPortalProvider(options.model)
    : undefined;

  if (options.mode) {
    config.orchestration.mode = options.mode as ManifoldConfig["orchestration"]["mode"];
  }

  const modelKeys = Object.keys(config.models);

  if (requestedPortalProvider) {
    if (supportsEmbeddedPortalProvider(requestedPortalProvider.id)) {
      options.model = requestedPortalProvider.id;
    } else {
    const selectedPortal = await selectPortalProvider(
      installedPortalProviders,
      requestedPortalProvider.id
    );

    console.log(`\nLaunching ${selectedPortal.name}...\n`);
    const exitCode = await launchPortalSession(selectedPortal);
      if (typeof exitCode === "number" && exitCode !== 0) {
        process.exit(exitCode);
      }
      return;
    }
  }

  if (modelKeys.length === 0) {
    if (installedPortalProviders.length > 0) {
      const selectedPortal = await selectPortalProvider(installedPortalProviders);
      console.log(
        `\nNo API-key models configured. Launching ${selectedPortal.name} instead...\n`
      );

      const exitCode = await launchPortalSession(selectedPortal);
      if (typeof exitCode === "number" && exitCode !== 0) {
        process.exit(exitCode);
      }
      return;
    }

    console.error(
      "\nNo AI models or portal providers detected.\n\n" +
        "Either:\n" +
        "  - install a portal CLI such as codex, claude, or gemini, then run `manifold login`\n" +
        "  - set an API key environment variable (ANTHROPIC_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY)\n" +
        "  - or create a manifold.toml configuration file\n\n" +
        "See: manifold init --help\n"
    );
    process.exit(1);
  }

  const orchestrator = new Orchestrator({
    config,
    projectRoot: projectDir,
  });

  for (const [id, modelConfig] of Object.entries(config.models)) {
    const adapter = createAdapter(id, modelConfig, projectDir);
    if (adapter) {
      orchestrator.registerAdapter(id, adapter);
    }
  }

  await orchestrator.initialize();

  const readyModels = orchestrator.getReadyModels();
  if (readyModels.length === 0) {
    console.error(
      "\nNo models could be initialized.\n" +
        "Check your API keys or use `manifold login` for a portal-backed session.\n"
    );
    process.exit(1);
  }

  const activeModel = options.model || readyModels[0].id;
  orchestrator.setActiveModel(activeModel);

  const { waitUntilExit } = render(React.createElement(App, { orchestrator }));
  await waitUntilExit();
}
