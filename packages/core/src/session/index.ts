/**
 * @manifold/core — Session Manager
 *
 * Manages session lifecycle — creation, persistence, and restoration.
 * Sessions track the full state of a Manifold interaction.
 */

import { randomUUID } from "node:crypto";
import type {
  Session,
  ManifoldMessage,
  TaskNode,
  OrchestrationMode,
} from "@manifold/sdk";

export class SessionManager {
  private currentSession: Session | null = null;
  private sessions = new Map<string, Session>();

  /**
   * Create a new session.
   */
  createSession(
    projectName: string,
    orchestrationMode: OrchestrationMode = "solo"
  ): Session {
    const session: Session = {
      id: randomUUID(),
      projectName,
      startedAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      messages: [],
      tasks: [],
      activeModels: [],
      orchestrationMode,
    };

    this.sessions.set(session.id, session);
    this.currentSession = session;
    return session;
  }

  /**
   * Get the current active session.
   */
  getCurrentSession(): Session | null {
    return this.currentSession;
  }

  /**
   * Get a session by ID.
   */
  getSession(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  /**
   * List all sessions.
   */
  listSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Add a message to the current session.
   */
  addMessage(message: ManifoldMessage): void {
    if (!this.currentSession) return;
    this.currentSession.messages.push(message);
    this.currentSession.lastActiveAt = new Date().toISOString();
  }

  /**
   * Add a task to the current session.
   */
  addTask(task: TaskNode): void {
    if (!this.currentSession) return;
    this.currentSession.tasks.push(task);
    this.currentSession.lastActiveAt = new Date().toISOString();
  }

  /**
   * Register a model as active in the current session.
   */
  addActiveModel(modelId: string): void {
    if (!this.currentSession) return;
    if (!this.currentSession.activeModels.includes(modelId)) {
      this.currentSession.activeModels.push(modelId);
    }
  }

  /**
   * Remove a model from the active list.
   */
  removeActiveModel(modelId: string): void {
    if (!this.currentSession) return;
    this.currentSession.activeModels = this.currentSession.activeModels.filter(
      (id) => id !== modelId
    );
  }

  /**
   * Set the orchestration mode for the current session.
   */
  setOrchestrationMode(mode: OrchestrationMode): void {
    if (!this.currentSession) return;
    this.currentSession.orchestrationMode = mode;
  }

  /**
   * End the current session.
   */
  endSession(): Session | null {
    const session = this.currentSession;
    this.currentSession = null;
    return session;
  }

  /**
   * Resume a previous session.
   */
  resumeSession(id: string): Session | undefined {
    const session = this.sessions.get(id);
    if (session) {
      this.currentSession = session;
      session.lastActiveAt = new Date().toISOString();
    }
    return session;
  }

  /**
   * Export session data for persistence.
   */
  exportSession(id?: string): string {
    const session = id ? this.sessions.get(id) : this.currentSession;
    if (!session) throw new Error("No session to export");
    return JSON.stringify(session, null, 2);
  }

  /**
   * Import a session from exported data.
   */
  importSession(data: string): Session {
    const session = JSON.parse(data) as Session;
    this.sessions.set(session.id, session);
    return session;
  }
}
