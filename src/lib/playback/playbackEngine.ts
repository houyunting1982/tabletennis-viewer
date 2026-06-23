import { loadCameraTrack, releaseCameraTrack } from "./cameraTrackLoader";
import { FrameClock } from "./frameClock";
import { fetchManifest } from "./manifest";
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
  private currentTrack: Array<DecodedFrame | undefined> = [];
  private readonly trackCache = new Map<string, DecodedFrame[]>();
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
      await this.loadCurrentCamera();
    } catch (err) {
      this.status = "idle";
      this.error = err instanceof Error ? err.message : "Failed to load manifest";
      this.emit();
    }
  }

  async setCameraIndex(index: number) {
    if (!this.manifest) {
      return;
    }

    const clamped = clamp(index, 0, this.manifest.cameras.length - 1);
    if (clamped === this.cameraIndex && this.status === "ready") {
      return;
    }

    this.pause();
    this.cameraIndex = clamped;
    await this.loadCurrentCamera();
  }

  setFrameIndex(index: number) {
    if (!this.manifest || this.currentTrack.length === 0) {
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
    if (!this.manifest || this.currentTrack.length === 0) {
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
    return this.currentTrack[this.frameIndex] ?? null;
  }

  dispose() {
    this.resetPlayback();
    this.listeners.clear();
  }

  private async loadCurrentCamera() {
    if (!this.manifest) {
      return;
    }

    const camera = this.manifest.cameras[this.cameraIndex];
    const cachedTrack = this.trackCache.get(camera.key);
    if (cachedTrack) {
      this.currentTrack = cachedTrack;
      this.frameIndex = clamp(this.frameIndex, 0, this.manifest.frameCount - 1);
      this.status = "ready";
      this.bufferProgress = this.manifest.frameCount;
      this.bufferTotal = this.manifest.frameCount;
      this.error = null;
      this.emit();
      return;
    }

    const token = ++this.loadingToken;
    this.status = "loading_camera";
    this.bufferProgress = 0;
    this.bufferTotal = this.manifest.frameCount;
    this.error = null;
    this.currentTrack = new Array(this.manifest.frameCount);
    this.emit();

    try {
      const result = await loadCameraTrack(this.manifest, camera.key, {
        onProgress: (loaded, total) => {
          if (token !== this.loadingToken) {
            return;
          }
          this.bufferProgress = loaded;
          this.bufferTotal = total;
          this.emit();
        },
        onFrameLoaded: (index, frame) => {
          if (token !== this.loadingToken) {
            return;
          }
          this.currentTrack[index] = frame;
          if (index === this.frameIndex) {
            this.emit();
          }
        },
      });

      if (token !== this.loadingToken) {
        releaseCameraTrack(result.frames);
        return;
      }

      this.trackCache.set(camera.key, result.frames);
      this.currentTrack = result.frames;
      this.frameIndex = clamp(this.frameIndex, 0, this.manifest.frameCount - 1);
      this.status = "ready";
      this.emit();
    } catch (err) {
      if (token !== this.loadingToken) {
        return;
      }

      this.status = "idle";
      this.error = err instanceof Error ? err.message : "Failed to load camera track";
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
    for (const frames of this.trackCache.values()) {
      releaseCameraTrack(frames);
    }
    this.trackCache.clear();
    this.currentTrack = [];
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

    return this.currentTrack.length === this.manifest.frameCount
      && this.currentTrack.every((frame) => frame !== undefined);
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
