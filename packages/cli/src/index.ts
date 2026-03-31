/**
 * @manifold/cli - Main Entry Point
 *
 * The CLI entry point using Commander.js.
 * Defines all available commands and their options.
 */

import { Command } from "commander";
import { runCommand } from "./commands/run.js";
import { initCommand } from "./commands/init.js";
import { statusCommand } from "./commands/status.js";
import { loginCommand } from "./commands/login.js";

const program = new Command();

program
  .name("manifold")
  .description("Manifold - A unified AI terminal where multiple models share the same brain")
  .version("0.1.0");

program
  .command("run")
  .description("Start the Manifold interactive terminal")
  .option("-m, --model <id>", "Set the initial active model or portal provider")
  .option(
    "--mode <mode>",
    "Orchestration mode (solo, collaborative, autonomous, consensus, pipeline)",
    "solo"
  )
  .option("-c, --config <path>", "Path to manifold.toml config file")
  .action(async (options) => {
    await runCommand(options);
  });

program
  .command("init")
  .description("Create a manifold.toml configuration file")
  .action(async () => {
    await initCommand();
  });

program
  .command("status")
  .description("Show Manifold status and detected models")
  .action(async () => {
    await statusCommand();
  });

program
  .command("login")
  .description("Launch a provider-native login flow for an installed portal CLI")
  .argument("[provider]", "Portal provider id (codex, claude, gemini)")
  .action(async (provider?: string) => {
    await loginCommand(provider);
  });

program.action(async () => {
  await runCommand({});
});

program.parse();
