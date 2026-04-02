<div align="center">

# ◈ Manifold

### A unified AI terminal where multiple models share the same brain.

[![License: MIT](https://img.shields.io/badge/License-MIT-magenta.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://typescriptlang.org)
[![Node.js](https://img.shields.io/badge/Node.js-≥20-green.svg)](https://nodejs.org)

</div>

<p align="center">
  <img src="docs/demo.gif" alt="Manifold Demo" width="720" />
</p>

---

**Manifold** is an open-source terminal interface where multiple AI models (Claude, Gemini, GPT, and more) share the same context, see each other's work, and orchestrate plans together. A multiplexer for AI minds.

## Desktop Beta

Windows desktop beta builds can be published through GitHub Releases.

- Current desktop releases are beta-quality and should be treated as early access builds.
- The Windows desktop build currently requires Node.js 20+ to be installed on the target machine.
- Claude Code, Gemini CLI, and Codex integrations still require those CLIs to be installed separately.
- Local Windows desktop development needs either Visual Studio C++ build tools or the GNU Rust toolchain. See `packages/desktop/README.md`.

Release instructions are documented in `RELEASING.md`.

## ✨ Why Manifold?

Every existing AI terminal tool either runs **one model at a time** or runs multiple models in **complete isolation**. Manifold is different:

| Feature | Other Tools | Manifold |
|:---|:---|:---|
| Multi-model | One at a time | All active simultaneously |
| Shared context | Each model sees only its own history | All models share the same brain |
| Inter-model communication | None | Models can ask, delegate, and review |
| Orchestration | Manual only | Solo, collaborative, autonomous, consensus, pipeline |
| Model-agnostic | Locked to one provider | Plugin adapter system — any model |

## 🚀 Quick Start

```bash
# Install
npm install -g @manifold/cli

# Or use directly with npx
npx @manifold/cli

# Set up your API key
export ANTHROPIC_API_KEY=sk-ant-...

# Start Manifold
manifold run
```

## ⚙️ Configuration

Create a `manifold.toml` in your project root:

```bash
manifold init
```

Or configure manually:

```toml
[project]
name = "my-app"

[models.claude]
role = "architect"
api_key_env = "ANTHROPIC_API_KEY"
model = "claude-sonnet-4-20250514"

[models.gemini]
role = "implementer"
api_key_env = "GEMINI_API_KEY"
model = "gemini-2.5-pro"

[orchestration]
mode = "collaborative"
context_sharing = true
auto_delegate = true
```

## 🏗️ Architecture

```
┌──────────────────────────────────────────┐
│            Terminal UI (Ink)              │
├──────────────────────────────────────────┤
│              Orchestrator                │
│   ┌─────────┐ ┌──────────┐ ┌─────────┐  │
│   │ Context  │ │ Message  │ │ Session │  │
│   │ Manager  │ │   Bus    │ │ Manager │  │
│   └─────────┘ └──────────┘ └─────────┘  │
├──────────────────────────────────────────┤
│          Model Adapters (Plugins)        │
│   ┌────────┐ ┌────────┐ ┌────────┐      │
│   │ Claude │ │ Gemini │ │ OpenAI │ ...  │
│   └────────┘ └────────┘ └────────┘      │
├──────────────────────────────────────────┤
│               Tool Layer                 │
│   ┌──────┐ ┌───────┐ ┌─────┐ ┌─────┐   │
│   │  FS  │ │ Shell │ │ Git │ │ MCP │   │
│   └──────┘ └───────┘ └─────┘ └─────┘   │
└──────────────────────────────────────────┘
```

## 🎯 Orchestration Modes

| Mode | Description |
|:---|:---|
| **Solo** | Single model, traditional chat experience |
| **Collaborative** | All models share context, user directs who does what |
| **Autonomous** | Orchestrator auto-routes tasks to the best model |
| **Consensus** | Models discuss and vote on approaches before executing |
| **Pipeline** | Tasks flow through models in sequence (plan → implement → review) |

## 📦 Packages

| Package | Description |
|:---|:---|
| `@manifold/cli` | CLI entry point and terminal UI |
| `@manifold/core` | Orchestrator, context manager, message bus |
| `@manifold/sdk` | Types, base adapter, message utilities |
| `@manifold/adapter-claude` | Anthropic Claude adapter |

## 🔌 Building Custom Adapters

```typescript
import { BaseAdapter } from "@manifold/sdk";

class MyAdapter extends BaseAdapter {
  async initialize() { /* set up API client */ }
  getCapabilities() { /* return model capabilities */ }
  async sendMessage(messages, options) { /* call your API */ }
  async *streamMessage(messages, options) { /* stream responses */ }
}
```

## 🛠️ Development

```bash
# Clone the repo
git clone https://github.com/efebolukbasi/manifold.git
cd manifold

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run the CLI in dev mode
pnpm --filter @manifold/cli dev
```

## 📄 License

MIT © [Manifold Contributors](LICENSE)

---

<div align="center">
  <sub>Built with ◈ by the open-source community</sub>
</div>
