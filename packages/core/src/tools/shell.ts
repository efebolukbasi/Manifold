/**
 * @manifold/core — Shell Execution Tool
 *
 * Allows AI models to run shell commands in the workspace.
 * Includes safety controls and output capture.
 */

import { spawn } from "node:child_process";
import type { ToolDefinition, ToolResult } from "@manifold/sdk";

export const shellTools: ToolDefinition[] = [
  {
    name: "run_command",
    description:
      "Run a shell command in the project directory. Returns stdout and stderr.",
    parameters: {
      command: {
        type: "string",
        description: "The command to execute",
      },
      timeout: {
        type: "number",
        description: "Timeout in milliseconds. Defaults to 30000 (30s)",
        default: 30000,
      },
    },
    required: ["command"],
  },
];

export class ShellToolExecutor {
  constructor(
    private projectRoot: string,
    private allowedCommands?: string[]
  ) {}

  async execute(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const callId = `shell_${Date.now()}`;

    if (toolName !== "run_command") {
      return {
        callId,
        name: toolName,
        result: `Unknown tool: ${toolName}`,
        isError: true,
      };
    }

    const command = args.command as string;
    const timeout = (args.timeout as number) || 30000;

    // Basic safety check
    if (this.allowedCommands) {
      const baseCmd = command.split(/\s+/)[0];
      if (baseCmd && !this.allowedCommands.includes(baseCmd)) {
        return {
          callId,
          name: "run_command",
          result: `Command not allowed: ${baseCmd}. Allowed: ${this.allowedCommands.join(", ")}`,
          isError: true,
        };
      }
    }

    try {
      const result = await this.runCommand(command, timeout);
      return {
        callId,
        name: "run_command",
        result,
      };
    } catch (error) {
      return {
        callId,
        name: "run_command",
        result: `Error: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  }

  private runCommand(command: string, timeout: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const isWindows = process.platform === "win32";
      const shell = isWindows ? "powershell.exe" : "/bin/sh";
      const shellFlag = isWindows ? "-Command" : "-c";

      const proc = spawn(shell, [shellFlag, command], {
        cwd: this.projectRoot,
        timeout,
        env: { ...process.env },
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        const output = [
          stdout ? `stdout:\n${stdout}` : "",
          stderr ? `stderr:\n${stderr}` : "",
          `exit code: ${code}`,
        ]
          .filter(Boolean)
          .join("\n\n");
        resolve(output);
      });

      proc.on("error", (err) => {
        reject(err);
      });
    });
  }
}
