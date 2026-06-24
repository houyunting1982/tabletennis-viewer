import { buildFrameUrl } from "./manifest";
import type { DecodedFrame, TechniqueManifest } from "./types";

export interface CameraTrackLoadResult {
  frames: DecodedFrame[];
}

export interface CameraTrackLoadCallbacks {
  onProgress?: (loaded: number, total: number) => void;
  onFrameLoaded?: (index: number, frame: DecodedFrame) => void;
}

export async function loadCameraTrack(
  manifest: TechniqueManifest,
  cameraKey: string,
  callbacks?: CameraTrackLoadCallbacks,
): Promise<CameraTrackLoadResult> {
  const filenames = manifest.frames[cameraKey];
  const total = filenames.length;
  const frames: DecodedFrame[] = new Array(total);

  const concurrency = 6;
  let nextIndex = 0;
  let completed = 0;

  async function worker() {
    while (nextIndex < total) {
      const index = nextIndex;
      nextIndex += 1;
      const frame = await decodeFrame(
        buildFrameUrl(manifest, cameraKey, index),
      );
      frames[index] = frame;
      completed += 1;
      callbacks?.onFrameLoaded?.(index, frame);
      callbacks?.onProgress?.(completed, total);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return { frames };
}

export async function decodeFrame(url: string): Promise<DecodedFrame> {
  const image = new Image();
  // Load cross-origin JPG via <img> (no CORS required for display-only playback).

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(`Failed to load frame: ${url}`));
    image.src = url;
  });

  if ("decode" in image) {
    await image.decode();
  }

  return { image, objectUrl: url };
}

export function releaseDecodedFrame(frame: DecodedFrame) {
  if (frame.objectUrl.startsWith("blob:")) {
    URL.revokeObjectURL(frame.objectUrl);
  }
}

export function releaseCameraTrack(frames: DecodedFrame[]) {
  for (const frame of frames) {
    releaseDecodedFrame(frame);
  }
}
