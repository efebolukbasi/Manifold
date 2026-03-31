/**
 * @manifold/core — File System Tools
 *
 * Built-in tools for reading, writing, and listing files in the workspace.
 * These are exposed to AI models as callable tools.
 */

import { readFile, writeFile, readdir, stat, mkdir } from "node:fs/promises";
import { join, relative, extname } from "node:path";
import { existsSync } from "node:fs";
import type { ToolDefinition, ToolResult, FileContext } from "@manifold/sdk";

// ─── Tool Definitions ────────────────────────────────────────────────

export const fileSystemTools: ToolDefinition[] = [
  {
    name: "read_file",
    description: "Read the contents of a file at the given path",
    parameters: {
      path: {
        type: "string",
        description: "Relative path to the file from the project root",
      },
    },
    required: ["path"],
  },
  {
    name: "write_file",
    description: "Write content to a file, creating it if it doesn't exist",
    parameters: {
      path: {
        type: "string",
        description: "Relative path to the file from the project root",
      },
      content: {
        type: "string",
        description: "Content to write to the file",
      },
    },
    required: ["path", "content"],
  },
  {
    name: "list_files",
    description:
      "List all files in a directory, optionally recursively",
    parameters: {
      path: {
        type: "string",
        description:
          "Relative path to the directory from the project root. Defaults to '.'",
      },
      recursive: {
        type: "boolean",
        description: "Whether to list files recursively. Defaults to false",
        default: false,
      },
    },
  },
  {
    name: "file_exists",
    description: "Check if a file or directory exists at the given path",
    parameters: {
      path: {
        type: "string",
        description: "Relative path to check",
      },
    },
    required: ["path"],
  },
];

// ─── Tool Executor ───────────────────────────────────────────────────

/**
 * Language detection based on file extension.
 */
function detectLanguage(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  const langMap: Record<string, string> = {
    ".ts": "typescript",
    ".tsx": "typescript",
    ".js": "javascript",
    ".jsx": "javascript",
    ".py": "python",
    ".rs": "rust",
    ".go": "go",
    ".java": "java",
    ".rb": "ruby",
    ".css": "css",
    ".html": "html",
    ".json": "json",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".toml": "toml",
    ".md": "markdown",
    ".sh": "shell",
    ".sql": "sql",
  };
  return langMap[ext] || "text";
}

export class FileSystemToolExecutor {
  constructor(private projectRoot: string) {}

  /**
   * Execute a file system tool call.
   */
  async execute(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    const callId = `fs_${Date.now()}`;

    try {
      switch (toolName) {
        case "read_file":
          return await this.readFile(callId, args.path as string);
        case "write_file":
          return await this.writeFile(
            callId,
            args.path as string,
            args.content as string
          );
        case "list_files":
          return await this.listFiles(
            callId,
            (args.path as string) || ".",
            (args.recursive as boolean) || false
          );
        case "file_exists":
          return await this.fileExists(callId, args.path as string);
        default:
          return {
            callId,
            name: toolName,
            result: `Unknown tool: ${toolName}`,
            isError: true,
          };
      }
    } catch (error) {
      return {
        callId,
        name: toolName,
        result: `Error: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  }

  private async readFile(callId: string, filePath: string): Promise<ToolResult> {
    const fullPath = join(this.projectRoot, filePath);
    const content = await readFile(fullPath, "utf-8");
    return {
      callId,
      name: "read_file",
      result: content,
    };
  }

  private async writeFile(
    callId: string,
    filePath: string,
    content: string
  ): Promise<ToolResult> {
    const fullPath = join(this.projectRoot, filePath);
    const dir = join(fullPath, "..");

    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    await writeFile(fullPath, content, "utf-8");
    return {
      callId,
      name: "write_file",
      result: `File written: ${filePath}`,
    };
  }

  private async listFiles(
    callId: string,
    dirPath: string,
    recursive: boolean
  ): Promise<ToolResult> {
    const fullPath = join(this.projectRoot, dirPath);
    const entries = await this.readDirEntries(fullPath, recursive);
    const relativePaths = entries.map((e) => relative(this.projectRoot, e));
    return {
      callId,
      name: "list_files",
      result: relativePaths.join("\n"),
    };
  }

  private async readDirEntries(
    dirPath: string,
    recursive: boolean
  ): Promise<string[]> {
    const entries: string[] = [];
    const items = await readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      // Skip hidden dirs and node_modules
      if (item.name.startsWith(".") || item.name === "node_modules") continue;

      const fullPath = join(dirPath, item.name);
      if (item.isDirectory()) {
        if (recursive) {
          const subEntries = await this.readDirEntries(fullPath, true);
          entries.push(...subEntries);
        }
      } else {
        entries.push(fullPath);
      }
    }

    return entries;
  }

  private async fileExists(
    callId: string,
    filePath: string
  ): Promise<ToolResult> {
    const fullPath = join(this.projectRoot, filePath);
    const exists = existsSync(fullPath);

    let fileType = "does not exist";
    if (exists) {
      const stats = await stat(fullPath);
      fileType = stats.isDirectory() ? "directory" : "file";
    }

    return {
      callId,
      name: "file_exists",
      result: JSON.stringify({ exists, type: fileType }),
    };
  }

  /**
   * Read a file and return a FileContext object for the context manager.
   */
  async readFileContext(filePath: string): Promise<FileContext> {
    const fullPath = join(this.projectRoot, filePath);
    const content = await readFile(fullPath, "utf-8");
    const stats = await stat(fullPath);

    return {
      path: filePath,
      content,
      language: detectLanguage(filePath),
      lastModified: stats.mtime.toISOString(),
    };
  }
}
