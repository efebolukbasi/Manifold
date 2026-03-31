/**
 * @manifold/core — Tool Registry
 *
 * Central registry for all tools available to models.
 * Manages tool definitions and routes execution to the right executor.
 */

import type { ToolDefinition, ToolResult } from "@manifold/sdk";
import { FileSystemToolExecutor, fileSystemTools } from "./file-system.js";
import { ShellToolExecutor, shellTools } from "./shell.js";

export type ToolExecutorFn = (
  toolName: string,
  args: Record<string, unknown>
) => Promise<ToolResult>;

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();
  private executors = new Map<string, ToolExecutorFn>();

  constructor(private projectRoot: string) {
    this.registerBuiltInTools();
  }

  private registerBuiltInTools(): void {
    // File system tools
    const fsExecutor = new FileSystemToolExecutor(this.projectRoot);
    for (const tool of fileSystemTools) {
      this.register(tool, (name, args) => fsExecutor.execute(name, args));
    }

    // Shell tools
    const shellExecutor = new ShellToolExecutor(this.projectRoot);
    for (const tool of shellTools) {
      this.register(tool, (name, args) => shellExecutor.execute(name, args));
    }
  }

  /**
   * Register a tool with its executor.
   */
  register(tool: ToolDefinition, executor: ToolExecutorFn): void {
    this.tools.set(tool.name, tool);
    this.executors.set(tool.name, executor);
  }

  /**
   * Get all registered tool definitions.
   */
  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get a tool definition by name.
   */
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Execute a tool by name.
   */
  async execute(
    name: string,
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const executor = this.executors.get(name);
    if (!executor) {
      return {
        callId: `unknown_${Date.now()}`,
        name,
        result: `Unknown tool: ${name}`,
        isError: true,
      };
    }
    return executor(name, args);
  }

  /**
   * Check if a tool is registered.
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }
}

export { FileSystemToolExecutor, fileSystemTools } from "./file-system.js";
export { ShellToolExecutor, shellTools } from "./shell.js";
