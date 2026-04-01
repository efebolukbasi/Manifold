import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["server.ts"],
  outDir: "dist",
  format: ["esm"],
  platform: "node",
  target: "node20",
  bundle: true,
  splitting: false,
  sourcemap: false,
  clean: true,
  dts: false,
  noExternal: [
    "@anthropic-ai/sdk",
    "@iarna/toml",
    "@manifold/adapter-claude",
    "@manifold/core",
    "@manifold/sdk",
  ],
});
