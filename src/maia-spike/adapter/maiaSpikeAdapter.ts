/**
 * MIT-licensed wrapper around the Maia worker. Only talks to it via
 * postMessage -- no vendored/GPL code is imported here, same isolation
 * `stockfishAdapter.ts` gives the real Stockfish engine.
 */

import type { MaiaEvaluation, MaiaTimings, MaiaWorkerRequest, MaiaWorkerResponse } from "./protocol";

export interface MaiaModelSpec {
  id: string;
  url: string;
}

interface PendingEvaluate {
  resolve(result: { evaluation: MaiaEvaluation; timings: MaiaTimings }): void;
  reject(err: Error): void;
}

export class MaiaSpikeAdapter {
  private worker: Worker | null = null;
  private nextRequestId = 0;
  private pending = new Map<number, PendingEvaluate>();
  private loadResolve: ((timings: MaiaTimings) => void) | null = null;
  private loadReject: ((err: Error) => void) | null = null;
  private onLoadProgress: ((loadedBytes: number, totalBytes: number) => void) | null = null;

  load(model: MaiaModelSpec, onProgress?: (loadedBytes: number, totalBytes: number) => void): Promise<MaiaTimings> {
    this.dispose();
    this.onLoadProgress = onProgress ?? null;

    const worker = new Worker(new URL("../worker/maia.worker.ts", import.meta.url), { type: "module" });
    this.worker = worker;

    worker.onmessage = (event: MessageEvent<MaiaWorkerResponse>) => this.handleMessage(event.data);
    worker.onerror = (event: ErrorEvent) => {
      const err = new Error(event.message || "Maia worker error");
      this.loadReject?.(err);
      this.loadReject = null;
      this.loadResolve = null;
      for (const p of this.pending.values()) p.reject(err);
      this.pending.clear();
    };

    return new Promise<MaiaTimings>((resolve, reject) => {
      this.loadResolve = resolve;
      this.loadReject = reject;
      const request: MaiaWorkerRequest = { type: "load", modelUrl: model.url, modelId: model.id };
      worker.postMessage(request);
    });
  }

  evaluate(fen: string): Promise<{ evaluation: MaiaEvaluation; timings: MaiaTimings }> {
    if (!this.worker) return Promise.reject(new Error("Model not loaded"));
    const id = this.nextRequestId++;
    const worker = this.worker;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const request: MaiaWorkerRequest = { type: "evaluate", id, fen };
      worker.postMessage(request);
    });
  }

  private handleMessage(msg: MaiaWorkerResponse): void {
    switch (msg.type) {
      case "load-progress":
        this.onLoadProgress?.(msg.loadedBytes, msg.totalBytes);
        break;
      case "loaded":
        this.loadResolve?.(msg.timings);
        this.loadResolve = null;
        this.loadReject = null;
        break;
      case "evaluated": {
        const pending = this.pending.get(msg.id);
        pending?.resolve({ evaluation: msg.result, timings: msg.timings });
        this.pending.delete(msg.id);
        break;
      }
      case "error": {
        const err = new Error(msg.message);
        if (msg.id !== undefined) {
          this.pending.get(msg.id)?.reject(err);
          this.pending.delete(msg.id);
        } else {
          this.loadReject?.(err);
          this.loadResolve = null;
          this.loadReject = null;
        }
        break;
      }
    }
  }

  dispose(): void {
    for (const p of this.pending.values()) p.reject(new Error("Adapter disposed"));
    this.pending.clear();
    this.loadReject?.(new Error("Adapter disposed"));
    this.loadResolve = null;
    this.loadReject = null;
    if (this.worker) {
      try {
        this.worker.terminate();
      } catch {
        // already gone
      }
      this.worker = null;
    }
  }
}
