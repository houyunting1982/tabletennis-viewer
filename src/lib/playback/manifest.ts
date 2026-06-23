import type { TechniqueManifest } from "./types";

export async function fetchManifest(url: string): Promise<TechniqueManifest> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load manifest (${response.status})`);
  }

  const manifest = (await response.json()) as TechniqueManifest;
  validateManifest(manifest);
  return manifest;
}

function validateManifest(manifest: TechniqueManifest) {
  if (!manifest.frameCount || manifest.frameCount < 1) {
    throw new Error("Manifest is missing frameCount");
  }

  if (!manifest.cameras?.length) {
    throw new Error("Manifest is missing cameras");
  }

  for (const camera of manifest.cameras) {
    const filenames = manifest.frames[camera.key];
    if (!filenames?.length) {
      throw new Error(`Manifest is missing frames for camera ${camera.key}`);
    }

    if (filenames.length !== manifest.frameCount) {
      throw new Error(
        `Camera ${camera.key} has ${filenames.length} frames, expected ${manifest.frameCount}`,
      );
    }
  }
}

export function buildFrameUrl(
  manifest: TechniqueManifest,
  cameraKey: string,
  frameIndex: number,
): string {
  const filename = manifest.frames[cameraKey][frameIndex];
  return `${manifest.baseUrl}/${encodeURIComponent(filename)}`;
}
