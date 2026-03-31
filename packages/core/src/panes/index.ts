import type { PaneState } from "@manifold/sdk";

const DEFAULT_PANE_COUNT = 1;

function createPane(id: number, modelId: string | null = null): PaneState {
  return {
    id,
    modelId,
    status: "idle",
    lastActiveAt: new Date().toISOString(),
  };
}

export class PaneManager {
  private panes: PaneState[];
  private paneCount = DEFAULT_PANE_COUNT;
  private activePaneId = 1;

  constructor(private readonly maxPanes = 4) {
    this.panes = Array.from({ length: maxPanes }, (_, index) =>
      createPane(index + 1)
    );
  }

  initialize(modelIds: string[], preferredModelId: string | null): void {
    const fallbackModelId = preferredModelId ?? modelIds[0] ?? null;

    this.panes = this.panes.map((pane, index) => {
      let modelId = pane.modelId;

      if (index === 0) {
        modelId = fallbackModelId;
      } else if (!modelId || !modelIds.includes(modelId)) {
        modelId = modelIds[index] ?? null;
      }

      return {
        ...pane,
        modelId,
        status: "idle",
      };
    });

    this.touchPane(this.activePaneId);
  }

  reconcileModels(modelIds: string[], preferredModelId: string | null): void {
    const fallbackModelId = preferredModelId ?? modelIds[0] ?? null;

    this.panes = this.panes.map((pane, index) => {
      if (pane.modelId && modelIds.includes(pane.modelId)) {
        return pane;
      }

      return {
        ...pane,
        modelId: index === 0 ? fallbackModelId : modelIds[index] ?? null,
        status: pane.status === "busy" ? "idle" : pane.status,
      };
    });
  }

  getPanes(): PaneState[] {
    return this.panes.map((pane) => ({ ...pane }));
  }

  getPane(paneId: number): PaneState | undefined {
    const pane = this.panes.find((entry) => entry.id === paneId);
    return pane ? { ...pane } : undefined;
  }

  getPaneCount(): number {
    return this.paneCount;
  }

  setPaneCount(count: number): void {
    if (count < 1 || count > this.maxPanes) {
      throw new Error(`Pane count must be between 1 and ${this.maxPanes}.`);
    }

    this.paneCount = count;
    if (this.activePaneId > count) {
      this.activePaneId = 1;
    }
    this.touchPane(this.activePaneId);
  }

  getActivePaneId(): number {
    return this.activePaneId;
  }

  setActivePane(paneId: number): void {
    if (paneId < 1 || paneId > this.maxPanes) {
      throw new Error(`Pane ${paneId} is out of range.`);
    }

    this.activePaneId = paneId;
    this.touchPane(paneId);
  }

  assignModel(paneId: number, modelId: string | null): void {
    this.updatePane(paneId, {
      modelId,
      lastActiveAt: new Date().toISOString(),
    });
  }

  setPaneStatus(paneId: number, status: PaneState["status"]): void {
    this.updatePane(paneId, { status });
  }

  getActiveModelId(): string | null {
    return this.panes.find((pane) => pane.id === this.activePaneId)?.modelId ?? null;
  }

  private touchPane(paneId: number): void {
    this.updatePane(paneId, {
      lastActiveAt: new Date().toISOString(),
    });
  }

  private updatePane(paneId: number, updates: Partial<PaneState>): void {
    const index = this.panes.findIndex((pane) => pane.id === paneId);
    if (index === -1) {
      throw new Error(`Pane ${paneId} does not exist.`);
    }

    this.panes[index] = {
      ...this.panes[index],
      ...updates,
    };
  }
}
