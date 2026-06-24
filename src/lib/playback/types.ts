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

export interface CameraLoadProgress {
  index: number;
  key: string;
  name: string;
  loaded: number;
  total: number;
  complete: boolean;
}

export interface CatalogTechnique {
  id: string;
  title: string;
  manifestUrl: string;
  previewUrl?: string;
  category?: "forehand" | "backhand" | "serve" | "footwork" | "fundamentals";
  frameCount?: number;
  cameraCount?: number;
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
  | "buffering"
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
  cameraBufferProgress: number;
  cameraBufferTotal: number;
  cameraProgress: CameraLoadProgress[];
  canPlay: boolean;
  canSwitchCamera: boolean;
  playbackRate: number;
  error: string | null;
}

export type PlaybackListener = (snapshot: PlaybackSnapshot) => void;

export interface DecodedFrame {
  image: HTMLImageElement;
  objectUrl: string;
}
