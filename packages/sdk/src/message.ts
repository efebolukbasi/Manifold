/**
 * @manifold/sdk — Message Utilities
 *
 * Helper functions for creating and working with ManifoldMessages.
 */

import type { ManifoldMessage, MessageType, ContextSlice } from "./types.js";
import { randomUUID } from "node:crypto";

/**
 * Create a new ManifoldMessage with defaults filled in.
 */
export function createMessage(
  params: {
    from: string;
    to: string | "all";
    type: MessageType;
    content: string;
    context?: ContextSlice;
    taskId?: string;
    priority?: number;
    requiresResponse?: boolean;
    parentMessageId?: string;
  }
): ManifoldMessage {
  return {
    id: randomUUID(),
    from: params.from,
    to: params.to,
    type: params.type,
    content: params.content,
    context: params.context,
    metadata: {
      taskId: params.taskId,
      priority: params.priority,
      requiresResponse: params.requiresResponse,
      parentMessageId: params.parentMessageId,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create a user message.
 */
export function createUserMessage(
  content: string,
  to: string | "all" = "all"
): ManifoldMessage {
  return createMessage({
    from: "user",
    to,
    type: "query",
    content,
  });
}

/**
 * Create a system message.
 */
export function createSystemMessage(
  content: string,
  to: string | "all" = "all"
): ManifoldMessage {
  return createMessage({
    from: "orchestrator",
    to,
    type: "system",
    content,
  });
}

/**
 * Create a delegation message.
 */
export function createDelegationMessage(
  from: string,
  to: string,
  content: string,
  taskId?: string
): ManifoldMessage {
  return createMessage({
    from,
    to,
    type: "delegate",
    content,
    taskId,
    requiresResponse: true,
  });
}

/**
 * Create an error message.
 */
export function createErrorMessage(
  from: string,
  content: string,
  to: string | "all" = "all"
): ManifoldMessage {
  return createMessage({
    from,
    to,
    type: "error",
    content,
  });
}

/**
 * Format a message for display in the TUI.
 */
export function formatMessageForDisplay(msg: ManifoldMessage): string {
  const prefix = msg.from === "user" ? "You" : msg.from;
  return `[${prefix}] ${msg.content}`;
}

/**
 * Check if a message is from the user.
 */
export function isUserMessage(msg: ManifoldMessage): boolean {
  return msg.from === "user";
}

/**
 * Check if a message is a system/orchestrator message.
 */
export function isSystemMessage(msg: ManifoldMessage): boolean {
  return msg.from === "orchestrator" && msg.type === "system";
}
