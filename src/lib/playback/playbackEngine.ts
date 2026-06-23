import { FrameClock } from "./frameClock";
import { fetchManifest } from "./manifest";
import {
  createEmptyFrameCache,
  isSliceReady,
  loadTechniqueFrameSlices,
  releaseFrameCache,
  type FrameCache,
} from "./techniqueBufferLoader";
import type {
  DecodedFrame,
  PlaybackListener,
  PlaybackSnapshot,
  PlaybackStatus,
  TechniqueManifest,
} from "./types";

const DEFAULT_PLAYBACK_RATE = 1;

export class PlaybackEngine {
  private manifest: TechniqueManifest | null = null;
  private cameraIndex = 0;
  private frameIndex = 0;
  private status: PlaybackStatus = "idle";
  private bufferProgress = 0;
  private bufferTotal = 0;
  private playbackRate = DEFAULT_PLAYBACK_RATE;
  private error: string | null = null;
  private readonly frameCache: FrameCache = new Map();
  private loadingToken = 0;
  private readonly listeners = new Set<PlaybackListener>();
  private readonly clock: FrameClock;

  constructor() {
    this.clock = new FrameClock({
      fps: 59,
      onTick: () => this.advanceFrame(true),
    });
  }

  subscribe(listener: PlaybackListener) {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  async loadManifest(url: string) {
    this.resetPlayback();
    this.status = "loading_manifest";
    this.error = null;
    this.emit();

    try {
      this.manifest = await fetchManifest(url);
      this.clock.setFps(this.manifest.timing.fps);
      await this.loadTechniqueBuffers();
    } catch (err) {
      this.status = "idle";
      this.error = err instanceof Error ? err.message : "Failed to load manifest";
      this.emit();
    }
  }

  setCameraIndex(index: number) {
    if (!this.manifest) {
      return;
    }

    const clamped = clamp(index, 0, this.manifest.cameras.length - 1);
    if (clamped === this.cameraIndex) {
      return;
    }

    this.pause();
    this.cameraIndex = clamped;
    this.emit();
  }

  setFrameIndex(index: number) {
    if (!this.manifest) {
      return;
    }

    this.pause();
    this.frameIndex = clamp(index, 0, this.manifest.frameCount - 1);
    if (this.isTrackComplete()) {
      this.status = "ready";
    }
    this.emit();
  }

  stepFrame(delta: number) {
    if (!this.manifest) {
      return;
    }

    this.pause();
    const next = this.frameIndex + delta;
    this.frameIndex = clamp(next, 0, this.manifest.frameCount - 1);
    if (this.isTrackComplete()) {
      this.status = "ready";
    }
    this.emit();
  }

  play() {
    if (!this.manifest || !this.isTrackComplete()) {
      return;
    }

    if (this.status === "playing") {
      return;
    }

    this.status = "playing";
    this.clock.setFps(this.manifest.timing.fps * this.playbackRate);
    this.clock.start();
    this.emit();
  }

  pause() {
    if (this.status !== "playing") {
      return;
    }

    this.clock.stop();
    this.status = "ready";
    this.emit();
  }

  togglePlay() {
    if (this.status === "playing") {
      this.pause();
      return;
    }

    this.play();
  }

  setPlaybackRate(rate: number) {
    this.playbackRate = rate;
    if (this.status === "playing" && this.manifest) {
      this.clock.setFps(this.manifest.timing.fps * this.playbackRate);
    }
    this.emit();
  }

  getCurrentFrame(): DecodedFrame | null {
    if (!this.manifest) {
      return null;
    }

    const cameraKey = this.manifest.cameras[this.cameraIndex].key;
    return this.frameCache.get(cameraKey)?.[this.frameIndex] ?? null;
  }

  isCurrentSliceReady(): boolean {
    if (!this.manifest) {
      return false;
    }

    return isSliceReady(this.manifest, this.frameCache, this.frameIndex);
  }

  dispose() {
    this.resetPlayback();
    this.listeners.clear();
  }

  private async loadTechniqueBuffers() {
    if (!this.manifest) {
      return;
    }

    const token = ++this.loadingToken;
    this.status = "loading_camera";
    this.bufferProgress = 0;
    this.bufferTotal = this.manifest.frameCount;
    this.error = null;
    this.frameCache.clear();
    createEmptyFrameCache(this.manifest).forEach((track, key) => {
      this.frameCache.set(key, track);
    });
    this.emit();

    try {
      await loadTechniqueFrameSlices(this.manifest, this.frameCache, {
        cameraConcurrency: 12,
        shouldAbort: () => token !== this.loadingToken,
        onProgress: (loaded, total) => {
          if (token !== this.loadingToken) {
            return;
          }
          this.bufferProgress = loaded;
          this.bufferTotal = total;
          this.emit();
        },
        onSliceLoaded: (frameIndex) => {
          if (token !== this.loadingToken) {
            return;
          }

          if (frameIndex === 0) {
            this.status = "ready";
          }

          if (frameIndex === this.frameIndex) {
            this.emit();
          }
        },
      });

      if (token !== this.loadingToken) {
        return;
      }

      this.status = "ready";
      this.emit();
    } catch (err) {
      if (token !== this.loadingToken) {
        return;
      }

      if (err instanceof Error && err.message === "Technique frame load aborted") {
        return;
      }

      this.status = "idle";
      this.error = err instanceof Error ? err.message : "Failed to load frames";
      this.emit();
    }
  }

  private advanceFrame(loop: boolean) {
    if (!this.manifest || !this.isTrackComplete()) {
      return;
    }

    const next = this.frameIndex + 1;
    if (next >= this.manifest.frameCount) {
      if (loop) {
        this.frameIndex = 0;
      } else {
        this.pause();
        this.frameIndex = this.manifest.frameCount - 1;
      }
    } else {
      this.frameIndex = next;
    }

    this.emit();
  }

  private resetPlayback() {
    this.loadingToken += 1;
    this.clock.stop();
    releaseFrameCache(this.frameCache);
    this.manifest = null;
    this.cameraIndex = 0;
    this.frameIndex = 0;
    this.bufferProgress = 0;
    this.bufferTotal = 0;
    this.playbackRate = DEFAULT_PLAYBACK_RATE;
    this.error = null;
    this.status = "idle";
    this.emit();
  }

  private isTrackComplete() {
    if (!this.manifest) {
      return false;
    }

    return this.bufferProgress >= this.bufferTotal;
  }

  private getSnapshot(): PlaybackSnapshot {
    return {
      status: this.status,
      manifest: this.manifest,
      cameraIndex: this.cameraIndex,
      frameIndex: this.frameIndex,
      frameCount: this.manifest?.frameCount ?? 0,
      cameraCount: this.manifest?.cameras.length ?? 0,
      bufferProgress: this.bufferProgress,
      bufferTotal: this.bufferTotal,
      playbackRate: this.playbackRate,
      error: this.error,
    };
  }

  private emit() {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
