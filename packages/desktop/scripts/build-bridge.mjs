import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageDir = resolve(scriptDir, "..");

const candidateModulePaths = [
  resolve(packageDir, "node_modules", "tsup", "dist", "index.js"),
  resolve(packageDir, "..", "sdk", "node_modules", "tsup", "dist", "index.js"),
  resolve(packageDir, "..", "core", "node_modules", "tsup", "dist", "index.js"),
  resolve(packageDir, "..", "adapters", "claude", "node_modules", "tsup", "dist", "index.js"),
];

const tsupModulePath = candidateModulePaths.find((candidate) => existsSync(candidate));

if (!tsupModulePath) {
  console.error(
    "Could not find tsup in the workspace. Run the workspace install first so the desktop bridge can be built.",
  );
  process.exit(1);
}

const { build } = await import(pathToFileURL(tsupModulePath).href);

await build({
  entry: ["bridge/server.ts"],
  outDir: "bridge/dist",
  format: ["cjs"],
  platform: "node",
  target: "node20",
  bundle: true,
  splitting: false,
  sourcemap: false,
  clean: true,
  dts: false,
  outExtension() {
    return {
      js: ".cjs",
    };
  },
  noExternal: [
    "@anthropic-ai/sdk",
    "@iarna/toml",
    "@manifold/adapter-claude",
    "@manifold/core",
    "@manifold/sdk",
  ],
});
