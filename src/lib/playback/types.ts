export interface CameraInfo {
  index: number;
  key: string;
  name: string;
}

export interface TechniqueManifest {
  id: string;
  title: string;
  playerId: string;
  frameCount: number;
  cameras: CameraInfo[];
  baseUrl: string;
  frames: Record<string, string[]>;
  timing: {
    fps: number;
  };
}

export interface CatalogTechnique {
  id: string;
  title: string;
  manifestUrl: string;
}

export interface CatalogPlayer {
  id: string;
  name: string;
  techniques: CatalogTechnique[];
}

export interface Catalog {
  players: CatalogPlayer[];
}

export type PlaybackStatus =
  | "idle"
  | "loading_manifest"
  | "loading_camera"
  | "ready"
  | "playing"
  | "paused";

export interface PlaybackSnapshot {
  status: PlaybackStatus;
  manifest: TechniqueManifest | null;
  cameraIndex: number;
  frameIndex: number;
  frameCount: number;
  cameraCount: number;
  bufferProgress: number;
  bufferTotal: number;
  playbackRate: number;
  error: string | null;
}

export type PlaybackListener = (snapshot: PlaybackSnapshot) => void;

export interface DecodedFrame {
  image: HTMLImageElement;
  objectUrl: string;
}
