/**
 * @manifold/cli - Status Command
 *
 * Shows the current Manifold status, detected models, portal providers,
 * configuration, and project info.
 */

import { loadConfig } from "../config/index.js";
import {
  buildEmbeddedPortalModels,
  detectInstalledPortalProviders,
} from "../portal/index.js";

export async function statusCommand(): Promise<void> {
  const projectDir = process.cwd();
  const config = await loadConfig(projectDir);
  const installedPortalProviders = await detectInstalledPortalProviders();
  const embeddedPortalModels = buildEmbeddedPortalModels(installedPortalProviders);
  const availableModels = {
    ...embeddedPortalModels,
    ...config.models,
  };

  console.log("\nMANIFOLD STATUS\n");
  console.log(`  Project:  ${config.project.name}`);
  console.log(`  Path:     ${config.project.path}`);
  console.log(`  Mode:     ${config.orchestration.mode}`);

  const modelKeys = Object.keys(availableModels);
  if (modelKeys.length === 0) {
    console.log("\n  No API-key models detected.\n");
  } else {
    console.log(`\n  Models (${modelKeys.length}):`);
    for (const [id, model] of Object.entries(availableModels)) {
      const isPortalModel = model.providerConfig?.transport === "portal-cli";
      const keySet = isPortalModel ? true : !!process.env[model.apiKeyEnv];
      const status = keySet ? "OK" : "MISSING";
      const suffix = isPortalModel
        ? " (portal login)"
        : keySet
          ? ""
          : " (key missing)";
      console.log(`    ${status} ${id} - ${model.model} [${model.role}]${suffix}`);
    }
  }

  if (installedPortalProviders.length === 0) {
    console.log("  Portal Providers: none detected");
  } else {
    console.log(`\n  Portal Providers (${installedPortalProviders.length}):`);
    for (const provider of installedPortalProviders) {
      console.log(`    OK ${provider.id} - ${provider.name}`);
    }
  }

  console.log("\n  Tools:");
  console.log(`    File System: ${config.tools?.enableFileSystem ? "OK" : "OFF"}`);
  console.log(`    Shell:       ${config.tools?.enableShell ? "OK" : "OFF"}`);
  console.log(`    Git:         ${config.tools?.enableGit ? "OK" : "OFF"}`);
  console.log(`    MCP:         ${config.tools?.enableMcp ? "OK" : "OFF"}`);
  console.log();
}
