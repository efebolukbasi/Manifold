/**
 * @manifold/cli - Init Command
 *
 * Creates a manifold.toml configuration file in the current directory.
 */

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

const EXAMPLE_CONFIG = `# Manifold Configuration
# https://github.com/efebolukbasi/manifold

[project]
name = "my-project"
path = "."

# Models
# Configure API-key-backed models below.
# If you prefer provider-native login, you can skip this file
# and use \`manifold login\` / \`manifold run\` with an installed portal CLI.

[models.claude]
role = "architect"              # architect, implementer, reviewer, executor, generalist
api_key_env = "ANTHROPIC_API_KEY"
model = "claude-sonnet-4-20250514"

# [models.gemini]
# role = "implementer"
# api_key_env = "GEMINI_API_KEY"
# model = "gemini-2.5-pro"

# [models.openai]
# role = "reviewer"
# api_key_env = "OPENAI_API_KEY"
# model = "gpt-4o"

# Orchestration

[orchestration]
mode = "solo"                   # solo, collaborative, autonomous, consensus, pipeline
context_sharing = true
auto_delegate = false

# Tools

[tools]
enable_file_system = true
enable_shell = true
enable_git = false
enable_mcp = false
exclude_paths = ["node_modules", ".git", "dist", "build"]
`;

export async function initCommand(): Promise<void> {
  const configPath = join(process.cwd(), "manifold.toml");

  if (existsSync(configPath)) {
    console.log("manifold.toml already exists. Use --force to overwrite.");
    return;
  }

  await writeFile(configPath, EXAMPLE_CONFIG, "utf-8");
  console.log(
    "\nCreated manifold.toml\n\n" +
      "Next steps:\n" +
      "  1. Either set your API key: export ANTHROPIC_API_KEY=sk-...\n" +
      "  2. Or use a portal CLI login flow: manifold login\n" +
      "  3. Edit manifold.toml to configure models and orchestration\n" +
      "  4. Run: manifold run\n"
  );
}
