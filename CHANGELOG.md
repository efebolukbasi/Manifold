# Changelog

All notable changes to Manifold will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0-5] - 2026-04-01

### Fixed

- Switched the desktop app version format to a numeric prerelease so Windows MSI bundling accepts the build

## [0.1.0-beta.4] - 2026-04-01

### Fixed

- Corrected the desktop bridge bundle entry/output paths so the GitHub release build can find `bridge/server.ts`
- Replaced a CommonJS-style `require` call in the bridge server with ESM-safe file reading

## [0.1.0-beta.3] - 2026-04-01

### Fixed

- Switched the desktop Rust toolchain configuration from an invalid GNU channel string to a standard stable channel with the Windows MSVC target
- Aligned the desktop crate version with the beta release version

## [0.1.0-beta.2] - 2026-04-01

### Fixed

- Synchronized `pnpm-lock.yaml` with the desktop beta release dependency changes so GitHub Actions can install with `--frozen-lockfile`

## [0.1.0-beta.1] - 2026-04-01

### Added

- Windows desktop beta release workflow for GitHub Releases
- Bundled desktop bridge asset in Tauri release artifacts
- Release documentation for the desktop beta flow

### Notes

- Desktop beta releases currently require Node.js 20+ on the target machine
- Desktop AI CLI integrations still depend on the corresponding provider CLIs being installed
- Windows binaries are not code signed yet

## [0.1.0] - 2026-03-30

### Added

- Initial project structure with pnpm + Turborepo monorepo
- `@manifold/sdk` — Core types, base adapter class, message utilities
- `@manifold/core` — Orchestrator, context manager, message bus, session manager, tool system
- `@manifold/adapter-claude` — Anthropic Claude adapter with streaming support
- `@manifold/cli` — CLI with Ink TUI, Commander.js commands
- TOML configuration with auto-detection of available models
- File system tools (read, write, list, exists)
- Shell execution tool
- Solo orchestration mode
- Slash commands: `/model`, `/mode`, `/models`, `/clear`, `/help`
