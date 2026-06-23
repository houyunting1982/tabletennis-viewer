import { buildFrameUrl } from "./manifest";
import { decodeFrame } from "./cameraTrackLoader";
import type { DecodedFrame, TechniqueManifest } from "./types";

export type FrameCache = Map<string, Array<DecodedFrame | undefined>>;

export interface TechniqueFrameLoadCallbacks {
  onSliceLoaded?: (frameIndex: number) => void;
  onProgress?: (loadedSlices: number, totalSlices: number) => void;
  shouldAbort?: () => boolean;
}

export function createEmptyFrameCache(manifest: TechniqueManifest): FrameCache {
  const cache: FrameCache = new Map();
  for (const camera of manifest.cameras) {
    cache.set(camera.key, new Array(manifest.frameCount));
  }
  return cache;
}

export async function loadTechniqueFrameSlices(
  manifest: TechniqueManifest,
  frameCache: FrameCache,
  options?: TechniqueFrameLoadCallbacks & { cameraConcurrency?: number },
): Promise<void> {
  const totalSlices = manifest.frameCount;
  const cameraConcurrency = options?.cameraConcurrency ?? 12;

  for (let frameIndex = 0; frameIndex < totalSlices; frameIndex += 1) {
    if (options?.shouldAbort?.()) {
      throw new Error("Technique frame load aborted");
    }

    await loadFrameSlice(
      manifest,
      frameCache,
      frameIndex,
      cameraConcurrency,
      options?.shouldAbort,
    );

    options?.onSliceLoaded?.(frameIndex);
    options?.onProgress?.(frameIndex + 1, totalSlices);
  }
}

async function loadFrameSlice(
  manifest: TechniqueManifest,
  frameCache: FrameCache,
  frameIndex: number,
  concurrency: number,
  shouldAbort?: () => boolean,
): Promise<void> {
  const cameras = manifest.cameras;
  let nextCamera = 0;

  async function worker() {
    while (nextCamera < cameras.length) {
      if (shouldAbort?.()) {
        return;
      }

      const cameraIndex = nextCamera;
      nextCamera += 1;
      const camera = cameras[cameraIndex];
      const frame = await decodeFrame(
        buildFrameUrl(manifest, camera.key, frameIndex),
      );

      if (shouldAbort?.()) {
        URL.revokeObjectURL(frame.objectUrl);
        return;
      }

      const track = frameCache.get(camera.key);
      if (track) {
        track[frameIndex] = frame;
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, cameras.length) }, () => worker()),
  );
}

export function releaseFrameCache(frameCache: FrameCache) {
  for (const track of frameCache.values()) {
    for (const frame of track) {
      if (frame) {
        URL.revokeObjectURL(frame.objectUrl);
      }
    }
  }
  frameCache.clear();
}

export function isSliceReady(
  manifest: TechniqueManifest,
  frameCache: FrameCache,
  frameIndex: number,
): boolean {
  for (const camera of manifest.cameras) {
    if (!frameCache.get(camera.key)?.[frameIndex]) {
      return false;
    }
  }
  return true;
}
