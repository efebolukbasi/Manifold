/**
 * @manifold/core - Session Manager
 *
 * Manages session lifecycle, persistence, and pane-aware session state.
 */

import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type {
  Session,
  ManifoldMessage,
  TaskNode,
  OrchestrationMode,
  PaneState,
  WorklogEntry,
  WorklogStatus,
} from "@manifold/sdk";

export interface SessionManagerOptions {
  projectRoot?: string;
  storageDir?: string;
  persist?: boolean;
  resumeLatest?: boolean;
}

interface LatestSessionPointer {
  sessionId: string;
  projectName: string;
  savedAt: string;
}

export interface WorklogUpdate {
  id?: string;
  title: string;
  summary: string;
  status: WorklogStatus;
  createdBy: string;
  modelId?: string;
  paneId?: number;
  taskId?: string;
  files?: string[];
  blockers?: string[];
  nextStep?: string;
}

export class SessionManager {
  private currentSession: Session | null = null;
  private sessions = new Map<string, Session>();
  private readonly persistToDisk: boolean;
  private readonly resumeLatestSession: boolean;
  private readonly storageDir: string | null;

  constructor(options: SessionManagerOptions = {}) {
    this.persistToDisk = options.persist ?? true;
    this.resumeLatestSession = options.resumeLatest ?? true;
    this.storageDir =
      options.storageDir ??
      (options.projectRoot ? join(options.projectRoot, ".manifold", "sessions") : null);
  }

  createSession(
    projectName: string,
    orchestrationMode: OrchestrationMode = "solo"
  ): Session {
    const resumed =
      this.resumeLatestSession ? this.loadLatestSession(projectName) : undefined;
    if (resumed) {
      resumed.orchestrationMode = orchestrationMode;
      resumed.lastActiveAt = new Date().toISOString();
      this.sessions.set(resumed.id, resumed);
      this.currentSession = resumed;
      this.persistSession(resumed);
      return resumed;
    }

    const now = new Date().toISOString();
    const session: Session = {
      id: randomUUID(),
      projectName,
      startedAt: now,
      lastActiveAt: now,
      messages: [],
      tasks: [],
      worklog: [],
      activeModels: [],
      orchestrationMode,
      panes: [],
      paneCount: 1,
      activePaneId: 1,
    };

    this.sessions.set(session.id, session);
    this.currentSession = session;
    this.persistSession(session);
    return session;
  }

  getCurrentSession(): Session | null {
    return this.currentSession;
  }

  getSession(id: string): Session | undefined {
    return this.sessions.get(id) ?? this.loadSessionFromDisk(id);
  }

  listSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  addMessage(message: ManifoldMessage): void {
    if (!this.currentSession) return;
    this.currentSession.messages.push(message);
    this.touchCurrentSession();
  }

  addTask(task: TaskNode): void {
    if (!this.currentSession) return;
    this.currentSession.tasks.push(task);
    this.touchCurrentSession();
  }

  addActiveModel(modelId: string): void {
    if (!this.currentSession) return;
    if (!this.currentSession.activeModels.includes(modelId)) {
      this.currentSession.activeModels.push(modelId);
      this.touchCurrentSession();
    }
  }

  removeActiveModel(modelId: string): void {
    if (!this.currentSession) return;
    this.currentSession.activeModels = this.currentSession.activeModels.filter(
      (id) => id !== modelId
    );
    this.touchCurrentSession();
  }

  setOrchestrationMode(mode: OrchestrationMode): void {
    if (!this.currentSession) return;
    this.currentSession.orchestrationMode = mode;
    this.touchCurrentSession();
  }

  setPanes(panes: PaneState[]): void {
    if (!this.currentSession) return;
    this.currentSession.panes = panes.map((pane) => ({ ...pane }));
    this.touchCurrentSession();
  }

  setPaneCount(count: number): void {
    if (!this.currentSession) return;
    this.currentSession.paneCount = count;
    this.touchCurrentSession();
  }

  setActivePane(paneId: number): void {
    if (!this.currentSession) return;
    this.currentSession.activePaneId = paneId;
    this.touchCurrentSession();
  }

  upsertWorklog(update: WorklogUpdate): WorklogEntry {
    if (!this.currentSession) {
      throw new Error("No active session");
    }

    const now = new Date().toISOString();
    const existingIndex = update.id
      ? this.currentSession.worklog.findIndex((entry) => entry.id === update.id)
      : -1;

    const existingEntry =
      existingIndex >= 0 ? this.currentSession.worklog[existingIndex] : undefined;

    const entry: WorklogEntry = {
      id: existingEntry?.id ?? update.id ?? randomUUID(),
      title: update.title,
      summary: update.summary,
      status: update.status,
      createdBy: existingEntry?.createdBy ?? update.createdBy,
      modelId: update.modelId,
      paneId: update.paneId,
      taskId: update.taskId,
      files: update.files,
      blockers: update.blockers,
      nextStep: update.nextStep,
      createdAt: existingEntry?.createdAt ?? now,
      updatedAt: now,
    };

    if (existingIndex === -1) {
      this.currentSession.worklog.push(entry);
    } else {
      this.currentSession.worklog[existingIndex] = entry;
    }

    this.touchCurrentSession();
    return entry;
  }

  getWorklog(count?: number): WorklogEntry[] {
    if (!this.currentSession) {
      return [];
    }

    if (count) {
      return this.currentSession.worklog.slice(-count);
    }

    return [...this.currentSession.worklog];
  }

  endSession(): Session | null {
    const session = this.currentSession;
    if (session) {
      this.persistSession(session);
    }
    this.currentSession = null;
    return session;
  }

  resumeSession(id: string): Session | undefined {
    const session = this.sessions.get(id) ?? this.loadSessionFromDisk(id);
    if (session) {
      this.currentSession = session;
      this.sessions.set(session.id, session);
      this.touchCurrentSession();
    }
    return session;
  }

  exportSession(id?: string): string {
    const session = id ? this.getSession(id) : this.currentSession;
    if (!session) {
      throw new Error("No session to export");
    }
    return JSON.stringify(session, null, 2);
  }

  importSession(data: string): Session {
    const session = JSON.parse(data) as Session;
    session.worklog = session.worklog ?? [];
    this.sessions.set(session.id, session);
    this.currentSession = session;
    this.persistSession(session);
    return session;
  }

  private touchCurrentSession(): void {
    if (!this.currentSession) return;
    this.currentSession.lastActiveAt = new Date().toISOString();
    this.persistSession(this.currentSession);
  }

  private loadLatestSession(projectName: string): Session | undefined {
    const pointerPath = this.getLatestPointerPath();
    if (!pointerPath || !existsSync(pointerPath)) {
      return undefined;
    }

    try {
      const pointer = JSON.parse(
        readFileSync(pointerPath, "utf-8")
      ) as LatestSessionPointer;
      if (pointer.projectName !== projectName) {
        return undefined;
      }

      return this.loadSessionFromDisk(pointer.sessionId);
    } catch {
      return undefined;
    }
  }

  private loadSessionFromDisk(id: string): Session | undefined {
    const filePath = this.getSessionPath(id);
    if (!filePath || !existsSync(filePath)) {
      return undefined;
    }

    try {
      const session = JSON.parse(readFileSync(filePath, "utf-8")) as Session;
      session.worklog = session.worklog ?? [];
      this.sessions.set(session.id, session);
      return session;
    } catch {
      return undefined;
    }
  }

  private persistSession(session: Session): void {
    if (!this.persistToDisk || !this.storageDir) {
      return;
    }

    mkdirSync(this.storageDir, { recursive: true });
    writeFileSync(this.getSessionPath(session.id)!, JSON.stringify(session, null, 2));

    const latestPointer: LatestSessionPointer = {
      sessionId: session.id,
      projectName: session.projectName,
      savedAt: new Date().toISOString(),
    };

    writeFileSync(this.getLatestPointerPath()!, JSON.stringify(latestPointer, null, 2));
  }

  private getSessionPath(id: string): string | null {
    if (!this.storageDir) {
      return null;
    }

    return join(this.storageDir, `${id}.json`);
  }

  private getLatestPointerPath(): string | null {
    if (!this.storageDir) {
      return null;
    }

    return join(this.storageDir, "latest.json");
  }
}
