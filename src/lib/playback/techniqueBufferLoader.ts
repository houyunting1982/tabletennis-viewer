import { buildFrameUrl } from "./manifest";
import { decodeFrame, releaseDecodedFrame } from "./cameraTrackLoader";
import type { CameraInfo, DecodedFrame, TechniqueManifest } from "./types";

export type FrameCache = Map<string, Array<DecodedFrame | undefined>>;

export const PLAY_READ_AHEAD = 10;
export const PLAYBACK_LOAD_CONCURRENCY = 3;
export const IDLE_LOAD_CONCURRENCY = 10;
const PRIMARY_CAMERA_INDEX = 0;

export interface CameraLoadProgress {
  index: number;
  key: string;
  name: string;
  loaded: number;
  total: number;
  complete: boolean;
}

export interface PhasedLoadContext {
  getFrameIndex: () => number;
  getCameraIndex: () => number;
  getIsPlaying: () => boolean;
}

export interface PhasedLoadCallbacks {
  onProgress?: () => void;
  onFrameLoaded?: (cameraKey: string, frameIndex: number) => void;
  shouldAbort?: () => boolean;
}

export interface PhasedTechniqueLoader {
  setContext: (context: PhasedLoadContext) => void;
  abort: () => void;
  done: Promise<void>;
}

export function createEmptyFrameCache(manifest: TechniqueManifest): FrameCache {
  const cache: FrameCache = new Map();
  for (const camera of manifest.cameras) {
    cache.set(camera.key, new Array(manifest.frameCount));
  }
  return cache;
}

export function countLoadedFrames(frameCache: FrameCache): number {
  let loaded = 0;
  for (const track of frameCache.values()) {
    for (const frame of track) {
      if (frame) {
        loaded += 1;
      }
    }
  }
  return loaded;
}

export function countLoadedCameraFrames(
  frameCache: FrameCache,
  cameraKey: string,
): number {
  const track = frameCache.get(cameraKey);
  if (!track) {
    return 0;
  }

  return track.filter(Boolean).length;
}

export function isCameraFrameReady(
  frameCache: FrameCache,
  cameraKey: string,
  frameIndex: number,
): boolean {
  return Boolean(frameCache.get(cameraKey)?.[frameIndex]);
}

export function isCameraPlayRangeReady(
  manifest: TechniqueManifest,
  frameCache: FrameCache,
  cameraKey: string,
  frameIndex: number,
  readAhead = PLAY_READ_AHEAD,
): boolean {
  const end = Math.min(frameIndex + readAhead, manifest.frameCount - 1);
  for (let index = frameIndex; index <= end; index += 1) {
    if (!isCameraFrameReady(frameCache, cameraKey, index)) {
      return false;
    }
  }
  return true;
}

export function isCameraTrackComplete(
  manifest: TechniqueManifest,
  frameCache: FrameCache,
  cameraKey: string,
): boolean {
  return countLoadedCameraFrames(frameCache, cameraKey) >= manifest.frameCount;
}

export function areAllCamerasReady(
  manifest: TechniqueManifest,
  frameCache: FrameCache,
): boolean {
  for (const camera of manifest.cameras) {
    if (!isCameraTrackComplete(manifest, frameCache, camera.key)) {
      return false;
    }
  }
  return true;
}

export function getPrimaryCamera(manifest: TechniqueManifest): CameraInfo {
  return manifest.cameras[PRIMARY_CAMERA_INDEX] ?? manifest.cameras[0];
}

export function buildCameraProgress(
  manifest: TechniqueManifest,
  frameCache: FrameCache,
): CameraLoadProgress[] {
  return manifest.cameras.map((camera) => {
    const loaded = countLoadedCameraFrames(frameCache, camera.key);
    return {
      index: camera.index,
      key: camera.key,
      name: camera.name,
      loaded,
      total: manifest.frameCount,
      complete: loaded >= manifest.frameCount,
    };
  });
}

function workKey(cameraKey: string, frameIndex: number) {
  return `${cameraKey}:${frameIndex}`;
}

function priorityForWork(
  manifest: TechniqueManifest,
  frameCache: FrameCache,
  cameraKey: string,
  frameIndex: number,
  context: PhasedLoadContext,
): number | null {
  if (isCameraFrameReady(frameCache, cameraKey, frameIndex)) {
    return null;
  }

  const primaryCamera = getPrimaryCamera(manifest);
  const playhead = context.getFrameIndex();
  const currentCamera = manifest.cameras[context.getCameraIndex()] ?? primaryCamera;
  const readAheadEnd = Math.min(playhead + PLAY_READ_AHEAD, manifest.frameCount - 1);
  const isPlaying = context.getIsPlaying();
  const primaryComplete = isCameraTrackComplete(
    manifest,
    frameCache,
    primaryCamera.key,
  );

  if (!primaryComplete) {
    if (cameraKey !== primaryCamera.key) {
      return null;
    }
    return frameIndex;
  }

  if (isPlaying) {
    if (cameraKey === currentCamera.key) {
      if (frameIndex >= playhead && frameIndex <= readAheadEnd) {
        return 0;
      }
      return 1;
    }
    const cameraIndex =
      manifest.cameras.find((camera) => camera.key === cameraKey)?.index ?? 99;
    return 500 + cameraIndex * manifest.frameCount + frameIndex;
  }

  const cameraIndex =
    manifest.cameras.find((camera) => camera.key === cameraKey)?.index ?? 99;
  return 200 + cameraIndex * manifest.frameCount + frameIndex;
}

export function startPhasedTechniqueLoad(
  manifest: TechniqueManifest,
  frameCache: FrameCache,
  initialContext: PhasedLoadContext,
  options?: PhasedLoadCallbacks & {
    concurrency?: number;
    playbackConcurrency?: number;
  },
): PhasedTechniqueLoader {
  const idleConcurrency = options?.concurrency ?? IDLE_LOAD_CONCURRENCY;
  const playbackConcurrency =
    options?.playbackConcurrency ?? PLAYBACK_LOAD_CONCURRENCY;
  let context = initialContext;
  let aborted = false;
  let concurrentLimit = idleConcurrency;
  const inFlight = new Set<string>();

  const emitProgress = () => {
    options?.onProgress?.();
  };

  const takeNextWork = (): { cameraKey: string; frameIndex: number } | null => {
    let best: { cameraKey: string; frameIndex: number; priority: number } | null =
      null;

    for (const camera of manifest.cameras) {
      for (let frameIndex = 0; frameIndex < manifest.frameCount; frameIndex += 1) {
        const key = workKey(camera.key, frameIndex);
        if (inFlight.has(key)) {
          continue;
        }

        const priority = priorityForWork(
          manifest,
          frameCache,
          camera.key,
          frameIndex,
          context,
        );
        if (priority === null) {
          continue;
        }

        if (
          !best ||
          priority < best.priority ||
          (priority === best.priority && frameIndex < best.frameIndex)
        ) {
          best = { cameraKey: camera.key, frameIndex, priority };
        }
      }
    }

    return best
      ? { cameraKey: best.cameraKey, frameIndex: best.frameIndex }
      : null;
  };

  const done = (async () => {
    emitProgress();

    async function worker() {
      while (!aborted) {
        while (inFlight.size >= concurrentLimit) {
          await new Promise((resolve) => setTimeout(resolve, 16));
          if (aborted) {
            return;
          }
        }

        const work = takeNextWork();
        if (!work) {
          if (inFlight.size === 0) {
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 16));
          continue;
        }

        const key = workKey(work.cameraKey, work.frameIndex);
        inFlight.add(key);

        try {
          const frame = await decodeFrame(
            buildFrameUrl(manifest, work.cameraKey, work.frameIndex),
          );

          if (aborted) {
            releaseDecodedFrame(frame);
            return;
          }

          const track = frameCache.get(work.cameraKey);
          if (track) {
            track[work.frameIndex] = frame;
          }

          options?.onFrameLoaded?.(work.cameraKey, work.frameIndex);
          emitProgress();
        } finally {
          inFlight.delete(key);
        }
      }
    }

    await Promise.all(
      Array.from({ length: idleConcurrency }, () => worker()),
    );

    if (aborted) {
      throw new Error("Technique frame load aborted");
    }
  })();

  return {
    setContext(nextContext: PhasedLoadContext) {
      context = nextContext;
      concurrentLimit = nextContext.getIsPlaying()
        ? playbackConcurrency
        : idleConcurrency;
    },
    abort() {
      aborted = true;
    },
    done,
  };
}

export function releaseFrameCache(frameCache: FrameCache) {
  for (const track of frameCache.values()) {
    for (const frame of track) {
      if (frame) {
        releaseDecodedFrame(frame);
      }
    }
  }
  frameCache.clear();
}

// Backwards-compatible re-exports used elsewhere
export function isSliceReady(
  manifest: TechniqueManifest,
  frameCache: FrameCache,
  frameIndex: number,
): boolean {
  for (const camera of manifest.cameras) {
    if (!isCameraFrameReady(frameCache, camera.key, frameIndex)) {
      return false;
    }
  }
  return true;
}

export type AdaptiveTechniqueLoader = PhasedTechniqueLoader;

export function startAdaptiveTechniqueLoad(
  manifest: TechniqueManifest,
  frameCache: FrameCache,
  initialContext: {
    getCameraIndex: () => number;
    getFrameIndex: () => number;
    getIsPlaying?: () => boolean;
  },
  options?: PhasedLoadCallbacks & {
    concurrency?: number;
    playbackConcurrency?: number;
  },
): PhasedTechniqueLoader {
  return startPhasedTechniqueLoad(
    manifest,
    frameCache,
    {
      getFrameIndex: initialContext.getFrameIndex,
      getCameraIndex: initialContext.getCameraIndex,
      getIsPlaying: initialContext.getIsPlaying ?? (() => false),
    },
    options,
  );
}
