/**
 * @manifold/cli - Status Command
 *
 * Shows the current Manifold status, detected models, portal providers,
 * configuration, and project info.
 */

import { loadConfig } from "../config/index.js";
import { detectInstalledPortalProviders } from "../portal/index.js";

export async function statusCommand(): Promise<void> {
  const projectDir = process.cwd();
  const config = await loadConfig(projectDir);
  const installedPortalProviders = await detectInstalledPortalProviders();

  console.log("\nMANIFOLD STATUS\n");
  console.log(`  Project:  ${config.project.name}`);
  console.log(`  Path:     ${config.project.path}`);
  console.log(`  Mode:     ${config.orchestration.mode}`);

  const modelKeys = Object.keys(config.models);
  if (modelKeys.length === 0) {
    console.log("\n  No API-key models detected.\n");
  } else {
    console.log(`\n  Models (${modelKeys.length}):`);
    for (const [id, model] of Object.entries(config.models)) {
      const keySet = !!process.env[model.apiKeyEnv];
      const status = keySet ? "OK" : "MISSING";
      const suffix = keySet ? "" : " (key missing)";
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
