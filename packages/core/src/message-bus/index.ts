/**
 * @manifold/core — Message Bus
 *
 * The inter-model communication layer. Models subscribe to messages,
 * send messages to each other, and the orchestrator broadcasts context updates.
 *
 * Uses an event emitter pattern for loose coupling.
 */

import { EventEmitter } from "node:events";
import type { ManifoldMessage, MessageType } from "@manifold/sdk";

export type MessageHandler = (message: ManifoldMessage) => void | Promise<void>;

export interface MessageFilter {
  from?: string;
  to?: string;
  type?: MessageType;
  taskId?: string;
}

export class MessageBus extends EventEmitter {
  private messageLog: ManifoldMessage[] = [];
  private subscribers = new Map<string, Set<MessageHandler>>();

  constructor() {
    super();
    this.setMaxListeners(50); // Support many model adapters
  }

  /**
   * Publish a message to the bus.
   * Routes to specific subscribers or broadcasts to all.
   */
  publish(message: ManifoldMessage): void {
    this.messageLog.push(message);

    // Emit to the global channel
    this.emit("message", message);

    // Emit to type-specific channel
    this.emit(`message:${message.type}`, message);

    // Route to specific target
    if (message.to === "all") {
      this.emit("broadcast", message);
    } else {
      this.emit(`model:${message.to}`, message);
    }

    // Also emit to source model's channel (for tracking)
    this.emit(`from:${message.from}`, message);
  }

  /**
   * Subscribe a model to receive messages directed at it.
   */
  subscribeModel(modelId: string, handler: MessageHandler): void {
    if (!this.subscribers.has(modelId)) {
      this.subscribers.set(modelId, new Set());
    }
    this.subscribers.get(modelId)!.add(handler);

    // Listen for direct messages
    this.on(`model:${modelId}`, handler);
    // Listen for broadcasts
    this.on("broadcast", handler);
  }

  /**
   * Unsubscribe a model from the bus.
   */
  unsubscribeModel(modelId: string): void {
    const handlers = this.subscribers.get(modelId);
    if (handlers) {
      for (const handler of handlers) {
        this.off(`model:${modelId}`, handler);
        this.off("broadcast", handler);
      }
      this.subscribers.delete(modelId);
    }
  }

  /**
   * Get message history, optionally filtered.
   */
  getHistory(filter?: MessageFilter): ManifoldMessage[] {
    if (!filter) return [...this.messageLog];

    return this.messageLog.filter((msg) => {
      if (filter.from && msg.from !== filter.from) return false;
      if (filter.to && msg.to !== filter.to) return false;
      if (filter.type && msg.type !== filter.type) return false;
      if (filter.taskId && msg.metadata.taskId !== filter.taskId) return false;
      return true;
    });
  }

  /**
   * Get the last N messages.
   */
  getRecentMessages(count: number): ManifoldMessage[] {
    return this.messageLog.slice(-count);
  }

  /**
   * Get all messages for a specific conversation between two parties.
   */
  getConversation(party1: string, party2: string): ManifoldMessage[] {
    return this.messageLog.filter(
      (msg) =>
        (msg.from === party1 && (msg.to === party2 || msg.to === "all")) ||
        (msg.from === party2 && (msg.to === party1 || msg.to === "all"))
    );
  }

  /**
   * Clear message history.
   */
  clearHistory(): void {
    this.messageLog = [];
  }

  /**
   * Get total message count.
   */
  get messageCount(): number {
    return this.messageLog.length;
  }
}
