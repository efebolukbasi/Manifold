/**
 * @manifold/core — Shared Context Manager
 *
 * The "brain" of Manifold. Maintains a unified context that all models
 * can read from and write to. Tracks files, conversation memory,
 * project state, and rules.
 */

import type {
  ContextSlice,
  FileContext,
  TaskNode,
  ManifoldMessage,
  WorklogEntry,
} from "@manifold/sdk";

export class ContextManager {
  private files = new Map<string, FileContext>();
  private conversationMemory: ManifoldMessage[] = [];
  private tasks: TaskNode[] = [];
  private worklog: WorklogEntry[] = [];
  private rules: string[] = [];
  private customContext = new Map<string, unknown>();
  private maxMemoryMessages = 200;

  /**
   * Add or update a file in the context.
   */
  addFile(file: FileContext): void {
    this.files.set(file.path, {
      ...file,
      lastModified: file.lastModified || new Date().toISOString(),
    });
  }

  /**
   * Remove a file from the context.
   */
  removeFile(path: string): void {
    this.files.delete(path);
  }

  /**
   * Get a file's context.
   */
  getFile(path: string): FileContext | undefined {
    return this.files.get(path);
  }

  /**
   * Get all tracked files.
   */
  getAllFiles(): FileContext[] {
    return Array.from(this.files.values());
  }

  /**
   * Record a message in conversation memory.
   */
  addMessage(message: ManifoldMessage): void {
    this.conversationMemory.push(message);

    // Keep memory bounded
    if (this.conversationMemory.length > this.maxMemoryMessages) {
      this.conversationMemory = this.conversationMemory.slice(
        -this.maxMemoryMessages
      );
    }
  }

  /**
   * Get conversation memory.
   */
  getMessages(count?: number): ManifoldMessage[] {
    if (count) {
      return this.conversationMemory.slice(-count);
    }
    return [...this.conversationMemory];
  }

  /**
   * Add a task to the project state.
   */
  addTask(task: TaskNode): void {
    this.tasks.push(task);
  }

  /**
   * Update a task's status.
   */
  updateTask(taskId: string, updates: Partial<TaskNode>): void {
    const findAndUpdate = (nodes: TaskNode[]): boolean => {
      for (const node of nodes) {
        if (node.id === taskId) {
          Object.assign(node, updates, { updatedAt: new Date().toISOString() });
          return true;
        }
        if (node.subtasks && findAndUpdate(node.subtasks)) {
          return true;
        }
      }
      return false;
    };
    findAndUpdate(this.tasks);
  }

  /**
   * Get all tasks.
   */
  getTasks(): TaskNode[] {
    return [...this.tasks];
  }

  /**
   * Add or update a worklog entry.
   */
  addWorklog(entry: WorklogEntry): void {
    const index = this.worklog.findIndex((item) => item.id === entry.id);
    if (index === -1) {
      this.worklog.push(entry);
      return;
    }

    this.worklog[index] = entry;
  }

  /**
   * Get recent worklog entries.
   */
  getWorklog(count?: number): WorklogEntry[] {
    if (count) {
      return this.worklog.slice(-count);
    }
    return [...this.worklog];
  }

  /**
   * Add a project rule/constraint.
   */
  addRule(rule: string): void {
    if (!this.rules.includes(rule)) {
      this.rules.push(rule);
    }
  }

  /**
   * Get all rules.
   */
  getRules(): string[] {
    return [...this.rules];
  }

  /**
   * Set custom context data.
   */
  setCustom(key: string, value: unknown): void {
    this.customContext.set(key, value);
  }

  /**
   * Get custom context data.
   */
  getCustom<T = unknown>(key: string): T | undefined {
    return this.customContext.get(key) as T | undefined;
  }

  /**
   * Build a context slice for sending to a model.
   * Includes the most relevant files, recent messages, current tasks, and rules.
   */
  buildContextSlice(options?: {
    maxFiles?: number;
    maxMessages?: number;
    relevantPaths?: string[];
  }): ContextSlice {
    const maxFiles = options?.maxFiles ?? 10;
    const maxMessages = options?.maxMessages ?? 50;

    let files: FileContext[];
    if (options?.relevantPaths?.length) {
      files = options.relevantPaths
        .map((path) => this.files.get(path))
        .filter((f): f is FileContext => f !== undefined)
        .slice(0, maxFiles);
    } else {
      files = Array.from(this.files.values()).slice(0, maxFiles);
    }

    return {
      files,
      messages: this.conversationMemory.slice(-maxMessages),
      tasks: this.tasks,
      worklog: this.worklog.slice(-20),
      rules: this.rules,
      custom: Object.fromEntries(this.customContext),
    };
  }

  /**
   * Clear all context.
   */
  clear(): void {
    this.files.clear();
    this.conversationMemory = [];
    this.tasks = [];
    this.worklog = [];
    this.rules = [];
    this.customContext.clear();
  }

  /**
   * Get a summary of the context state.
   */
  getSummary(): {
      fileCount: number;
      messageCount: number;
      taskCount: number;
      worklogCount: number;
      ruleCount: number;
  } {
    return {
      fileCount: this.files.size,
      messageCount: this.conversationMemory.length,
      taskCount: this.tasks.length,
      worklogCount: this.worklog.length,
      ruleCount: this.rules.length,
    };
  }
}
