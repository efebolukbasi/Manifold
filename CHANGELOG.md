# Changelog

All notable changes to Manifold will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0-11] - 2026-04-02

### Fixed

- Stripped `\\?\` extended-length path prefix from Windows bridge script path to prevent Node.js EISDIR error

## [0.1.0-10] - 2026-04-02

### Fixed

- Launched the packaged bridge through `node --eval` to avoid Windows absolute-path entrypoint resolution failing on `C:`

## [0.1.0-9] - 2026-04-01

### Fixed

- Normalized packaged Windows project-root detection to avoid malformed startup paths
- Added copyable bridge error details in the desktop status bar

## [0.1.0-8] - 2026-04-01

### Fixed

- Prevented the desktop app from hanging in `connecting` when the packaged bridge exits during startup
- Captured bridge stderr so packaged startup failures surface as actionable errors instead of freezes

## [0.1.0-7] - 2026-04-01

### Fixed

- Added a Windows local desktop dev fallback when the MSVC linker is unavailable
- Built the desktop bridge and workspace dependencies before `tauri dev` starts
- Switched the desktop bridge bundle to CommonJS and fixed packaged resource lookup for release builds

## [0.1.0-6] - 2026-04-01

### Fixed

- Removed the hard-coded GNU Windows cargo target so desktop release builds use the MSVC target consistently

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
