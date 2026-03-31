# Contributing to Manifold

Thank you for your interest in contributing to Manifold! 🎉

## Getting Started

1. **Fork** the repository
2. **Clone** your fork:
   ```bash
   git clone https://github.com/<your-username>/manifold.git
   cd manifold
   ```
3. **Install** dependencies:
   ```bash
   pnpm install
   ```
4. **Build** all packages:
   ```bash
   pnpm build
   ```

## Development Workflow

### Project Structure

Manifold is a monorepo managed by pnpm workspaces and Turborepo:

- `packages/sdk/` — Core types and base adapter (`@manifold/sdk`)
- `packages/core/` — Engine: orchestrator, context, message bus (`@manifold/core`)
- `packages/cli/` — CLI and terminal UI (`@manifold/cli`)
- `packages/adapters/` — Model adapters (claude, gemini, etc.)

### Common Tasks

```bash
# Build everything
pnpm build

# Run the CLI in dev mode
pnpm --filter @manifold/cli dev

# Type-check all packages
pnpm typecheck

# Run tests
pnpm test

# Clean build artifacts
pnpm clean
```

### Adding a New Adapter

1. Create a new directory: `packages/adapters/<name>/`
2. Copy the structure from `packages/adapters/claude/`
3. Implement `BaseAdapter` from `@manifold/sdk`
4. Register it in the CLI's adapter factory (`packages/cli/src/commands/run.ts`)

## Code Style

- **TypeScript** with strict mode
- **ESM** modules (`type: "module"`)
- Meaningful, descriptive names
- JSDoc comments for public APIs

## Pull Requests

- Create a feature branch from `main`
- Write clear commit messages
- Add tests for new functionality
- Update documentation if behavior changes
- Keep PRs focused and small

## Reporting Issues

- Use GitHub Issues
- Include reproduction steps
- Include your Node.js version and OS
- Include relevant error messages

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
