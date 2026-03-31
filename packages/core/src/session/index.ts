/**
 * @manifold/core - Session Manager
 *
 * Manages session lifecycle, persistence, and pane-aware session state.
 */

import { randomUUID } from "node:crypto";
import type {
  Session,
  ManifoldMessage,
  TaskNode,
  OrchestrationMode,
  PaneState,
} from "@manifold/sdk";

export class SessionManager {
  private currentSession: Session | null = null;
  private sessions = new Map<string, Session>();

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
      panes: [],
      paneCount: 1,
      activePaneId: 1,
    };

    this.sessions.set(session.id, session);
    this.currentSession = session;
    return session;
  }

  getCurrentSession(): Session | null {
    return this.currentSession;
  }

  getSession(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  listSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  addMessage(message: ManifoldMessage): void {
    if (!this.currentSession) return;
    this.currentSession.messages.push(message);
    this.currentSession.lastActiveAt = new Date().toISOString();
  }

  addTask(task: TaskNode): void {
    if (!this.currentSession) return;
    this.currentSession.tasks.push(task);
    this.currentSession.lastActiveAt = new Date().toISOString();
  }

  addActiveModel(modelId: string): void {
    if (!this.currentSession) return;
    if (!this.currentSession.activeModels.includes(modelId)) {
      this.currentSession.activeModels.push(modelId);
      this.currentSession.lastActiveAt = new Date().toISOString();
    }
  }

  removeActiveModel(modelId: string): void {
    if (!this.currentSession) return;
    this.currentSession.activeModels = this.currentSession.activeModels.filter(
      (id) => id !== modelId
    );
    this.currentSession.lastActiveAt = new Date().toISOString();
  }

  setOrchestrationMode(mode: OrchestrationMode): void {
    if (!this.currentSession) return;
    this.currentSession.orchestrationMode = mode;
    this.currentSession.lastActiveAt = new Date().toISOString();
  }

  setPanes(panes: PaneState[]): void {
    if (!this.currentSession) return;
    this.currentSession.panes = panes.map((pane) => ({ ...pane }));
    this.currentSession.lastActiveAt = new Date().toISOString();
  }

  setPaneCount(count: number): void {
    if (!this.currentSession) return;
    this.currentSession.paneCount = count;
    this.currentSession.lastActiveAt = new Date().toISOString();
  }

  setActivePane(paneId: number): void {
    if (!this.currentSession) return;
    this.currentSession.activePaneId = paneId;
    this.currentSession.lastActiveAt = new Date().toISOString();
  }

  endSession(): Session | null {
    const session = this.currentSession;
    this.currentSession = null;
    return session;
  }

  resumeSession(id: string): Session | undefined {
    const session = this.sessions.get(id);
    if (session) {
      this.currentSession = session;
      session.lastActiveAt = new Date().toISOString();
    }
    return session;
  }

  exportSession(id?: string): string {
    const session = id ? this.sessions.get(id) : this.currentSession;
    if (!session) {
      throw new Error("No session to export");
    }
    return JSON.stringify(session, null, 2);
  }

  importSession(data: string): Session {
    const session = JSON.parse(data) as Session;
    this.sessions.set(session.id, session);
    return session;
  }
}
