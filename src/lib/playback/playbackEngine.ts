import { FrameClock } from "./frameClock";
import { fetchManifest } from "./manifest";
import {
  areAllCamerasReady,
  buildCameraProgress,
  countLoadedCameraFrames,
  countLoadedFrames,
  createEmptyFrameCache,
  getPrimaryCamera,
  isCameraFrameReady,
  isCameraTrackComplete,
  releaseFrameCache,
  startPhasedTechniqueLoad,
  type FrameCache,
  type PhasedTechniqueLoader,
} from "./techniqueBufferLoader";
import type {
  CameraLoadProgress,
  DecodedFrame,
  PlaybackListener,
  PlaybackSnapshot,
  PlaybackStatus,
  TechniqueManifest,
} from "./types";

const DEFAULT_PLAYBACK_RATE = 1;
const PROGRESS_EMIT_MS = 250;

export class PlaybackEngine {
  private manifest: TechniqueManifest | null = null;
  private cameraIndex = 0;
  private frameIndex = 0;
  private status: PlaybackStatus = "idle";
  private bufferProgress = 0;
  private bufferTotal = 0;
  private cameraBufferProgress = 0;
  private cameraBufferTotal = 0;
  private cameraProgress: CameraLoadProgress[] = [];
  private playbackRate = DEFAULT_PLAYBACK_RATE;
  private error: string | null = null;
  private readonly frameCache: FrameCache = new Map();
  private loadingToken = 0;
  private activeLoader: PhasedTechniqueLoader | null = null;
  private resumeAfterBuffer = false;
  private lastProgressEmitMs = 0;
  private progressEmitTimer: ReturnType<typeof setTimeout> | null = null;
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
      this.cameraIndex = 0;
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

    const cameraKey = this.manifest.cameras[clamped].key;
    if (!isCameraTrackComplete(this.manifest, this.frameCache, cameraKey)) {
      return;
    }

    this.cameraIndex = clamped;
    this.syncLoaderContext();
    this.syncProgressMetrics();
    this.emit();
  }

  stepCamera(delta: number) {
    if (!this.manifest) {
      return;
    }

    const readyIndices = this.manifest.cameras
      .map((camera, index) =>
        isCameraTrackComplete(this.manifest!, this.frameCache, camera.key)
          ? index
          : null,
      )
      .filter((index): index is number => index !== null);

    if (readyIndices.length === 0) {
      return;
    }

    const currentPos = readyIndices.indexOf(this.cameraIndex);
    const startPos = currentPos === -1 ? (delta > 0 ? -1 : readyIndices.length) : currentPos;
    const nextPos = startPos + delta;
    if (nextPos < 0 || nextPos >= readyIndices.length) {
      return;
    }

    this.setCameraIndex(readyIndices[nextPos]);
  }

  setFrameIndex(index: number) {
    if (!this.manifest) {
      return;
    }

    const wasPlaying = this.status === "playing";
    if (!wasPlaying) {
      this.pause();
    }

    this.frameIndex = clamp(index, 0, this.manifest.frameCount - 1);
    this.syncLoaderContext();
    this.syncProgressMetrics();
    this.updateReadyState();
    this.emit();
  }

  stepFrame(delta: number) {
    if (!this.manifest) {
      return;
    }

    const wasPlaying = this.status === "playing";
    if (!wasPlaying) {
      this.pause();
    }

    const next = this.frameIndex + delta;
    this.frameIndex = clamp(next, 0, this.manifest.frameCount - 1);
    this.syncLoaderContext();
    this.syncProgressMetrics();
    this.updateReadyState();
    this.emit();
  }

  play() {
    if (!this.manifest || !this.canPlay()) {
      return;
    }

    if (this.status === "playing") {
      return;
    }

    this.resumeAfterBuffer = false;
    this.status = "playing";
    this.syncLoaderContext();
    this.clock.setFps(this.manifest.timing.fps * this.playbackRate);
    this.clock.start();
    this.emit();
  }

  pause() {
    if (this.status !== "playing" && this.status !== "buffering") {
      return;
    }

    this.clock.stop();
    this.resumeAfterBuffer = false;
    this.status = "ready";
    this.syncLoaderContext();
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

  canPlay(): boolean {
    if (!this.manifest) {
      return false;
    }

    const primaryCamera = getPrimaryCamera(this.manifest);
    return isCameraTrackComplete(
      this.manifest,
      this.frameCache,
      primaryCamera.key,
    );
  }

  canSwitchCamera(): boolean {
    if (!this.manifest) {
      return false;
    }

    return areAllCamerasReady(this.manifest, this.frameCache);
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
    this.error = null;
    this.frameCache.clear();
    createEmptyFrameCache(this.manifest).forEach((track, key) => {
      this.frameCache.set(key, track);
    });
    this.syncProgressMetrics();
    this.emitProgress(true);

    const loader = startPhasedTechniqueLoad(
      this.manifest,
      this.frameCache,
      {
        getFrameIndex: () => this.frameIndex,
        getCameraIndex: () => this.cameraIndex,
        getIsPlaying: () =>
          this.status === "playing" || this.status === "buffering",
      },
      {
        onProgress: () => {
          if (token !== this.loadingToken) {
            return;
          }
          this.emitProgress();
        },
        onFrameLoaded: (cameraKey, frameIndex) => {
          if (token !== this.loadingToken) {
            return;
          }

          const primaryKey = getPrimaryCamera(this.manifest!).key;
          const currentKey = this.manifest!.cameras[this.cameraIndex].key;
          if (
            (cameraKey === primaryKey || cameraKey === currentKey) &&
            frameIndex === this.frameIndex
          ) {
            this.emit();
          }

          if (this.status === "buffering" && this.canPlay()) {
            this.tryResumePlayback();
            return;
          }

          if (this.status === "playing") {
            this.tryAdvanceOrStall();
          }
        },
      },
    );

    this.activeLoader = loader;

    try {
      await loader.done;

      if (token !== this.loadingToken) {
        return;
      }

      this.syncProgressMetrics();
      this.updateReadyState();
      this.emitProgress(true);
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
    } finally {
      if (this.activeLoader === loader) {
        this.activeLoader = null;
      }
    }
  }

  private emitProgress(force = false) {
    const now = performance.now();
    if (force || now - this.lastProgressEmitMs >= PROGRESS_EMIT_MS) {
      if (this.progressEmitTimer) {
        clearTimeout(this.progressEmitTimer);
        this.progressEmitTimer = null;
      }
      this.lastProgressEmitMs = now;
      this.syncProgressMetrics();
      this.updateReadyState();
      this.emit();
      return;
    }

    if (this.progressEmitTimer) {
      return;
    }

    this.progressEmitTimer = setTimeout(() => {
      this.progressEmitTimer = null;
      this.emitProgress(true);
    }, PROGRESS_EMIT_MS);
  }

  private syncLoaderContext() {
    this.activeLoader?.setContext({
      getFrameIndex: () => this.frameIndex,
      getCameraIndex: () => this.cameraIndex,
      getIsPlaying: () =>
        this.status === "playing" || this.status === "buffering",
    });
  }

  private syncProgressMetrics() {
    if (!this.manifest) {
      return;
    }

    const primaryCamera = getPrimaryCamera(this.manifest);
    this.cameraBufferProgress = countLoadedCameraFrames(
      this.frameCache,
      primaryCamera.key,
    );
    this.cameraBufferTotal = this.manifest.frameCount;
    this.bufferProgress = countLoadedFrames(this.frameCache);
    this.bufferTotal = this.manifest.frameCount * this.manifest.cameras.length;
    this.cameraProgress = buildCameraProgress(this.manifest, this.frameCache);
  }

  private updateReadyState() {
    if (!this.manifest) {
      return;
    }

    if (this.status === "playing" || this.status === "buffering") {
      return;
    }

    if (this.canPlay() || this.getCurrentFrame()) {
      this.status = "ready";
      return;
    }

    if (this.status !== "loading_manifest") {
      this.status = "loading_camera";
    }
  }

  private tryResumePlayback() {
    if (!this.manifest || !this.canPlay() || !this.resumeAfterBuffer) {
      return;
    }

    const cameraKey = this.manifest.cameras[this.cameraIndex].key;
    if (!isCameraFrameReady(this.frameCache, cameraKey, this.frameIndex)) {
      return;
    }

    this.resumeAfterBuffer = false;
    this.status = "playing";
    this.syncLoaderContext();
    this.clock.setFps(this.manifest.timing.fps * this.playbackRate);
    this.clock.start();
    this.emit();
  }

  private tryAdvanceOrStall() {
    if (!this.manifest || this.status !== "playing") {
      return;
    }

    const cameraKey = this.manifest.cameras[this.cameraIndex].key;
    const nextIndex = this.frameIndex + 1;

    if (nextIndex >= this.manifest.frameCount) {
      this.frameIndex = 0;
      if (!isCameraFrameReady(this.frameCache, cameraKey, this.frameIndex)) {
        this.stallPlayback();
      } else {
        this.syncLoaderContext();
        this.emit();
      }
      return;
    }

    if (isCameraFrameReady(this.frameCache, cameraKey, nextIndex)) {
      this.frameIndex = nextIndex;
      this.syncLoaderContext();
      this.emit();
      return;
    }

    this.stallPlayback();
  }

  private stallPlayback() {
    this.clock.stop();
    this.resumeAfterBuffer = true;
    this.status = "buffering";
    this.syncLoaderContext();
    this.emit();
  }

  private advanceFrame(_loop: boolean) {
    if (!this.manifest || this.status !== "playing") {
      return;
    }

    this.tryAdvanceOrStall();
  }

  private resetPlayback() {
    this.loadingToken += 1;
    this.clock.stop();
    this.activeLoader?.abort();
    this.activeLoader = null;
    if (this.progressEmitTimer) {
      clearTimeout(this.progressEmitTimer);
      this.progressEmitTimer = null;
    }
    releaseFrameCache(this.frameCache);
    this.manifest = null;
    this.cameraIndex = 0;
    this.frameIndex = 0;
    this.bufferProgress = 0;
    this.bufferTotal = 0;
    this.cameraBufferProgress = 0;
    this.cameraBufferTotal = 0;
    this.cameraProgress = [];
    this.playbackRate = DEFAULT_PLAYBACK_RATE;
    this.resumeAfterBuffer = false;
    this.lastProgressEmitMs = 0;
    this.error = null;
    this.status = "idle";
    this.emit();
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
      cameraBufferProgress: this.cameraBufferProgress,
      cameraBufferTotal: this.cameraBufferTotal,
      cameraProgress: this.cameraProgress,
      canPlay: this.canPlay(),
      canSwitchCamera: this.canSwitchCamera(),
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
