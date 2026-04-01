import { defineConfig } from "tsup";

export default defineConfig({
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
