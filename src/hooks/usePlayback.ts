import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PlaybackEngine,
  type DecodedFrame,
  type PlaybackSnapshot,
} from "../lib/playback";

export function usePlayback() {
  const engine = useMemo(() => new PlaybackEngine(), []);
  const [snapshot, setSnapshot] = useState<PlaybackSnapshot>(() => ({
    status: "idle",
    manifest: null,
    cameraIndex: 0,
    frameIndex: 0,
    frameCount: 0,
    cameraCount: 0,
    bufferProgress: 0,
    bufferTotal: 0,
    playbackRate: 1,
    error: null,
  }));
  const [currentFrame, setCurrentFrame] = useState<DecodedFrame | null>(null);

  useEffect(() => {
    return engine.subscribe((nextSnapshot) => {
      setSnapshot(nextSnapshot);
      setCurrentFrame(engine.getCurrentFrame());
    });
  }, [engine]);

  useEffect(() => () => engine.dispose(), [engine]);

  const loadManifest = useCallback(
    (url: string) => engine.loadManifest(url),
    [engine],
  );
  const setCameraIndex = useCallback(
    (index: number) => engine.setCameraIndex(index),
    [engine],
  );
  const setFrameIndex = useCallback(
    (index: number) => engine.setFrameIndex(index),
    [engine],
  );
  const stepFrame = useCallback(
    (delta: number) => engine.stepFrame(delta),
    [engine],
  );
  const play = useCallback(() => engine.play(), [engine]);
  const pause = useCallback(() => engine.pause(), [engine]);
  const togglePlay = useCallback(() => engine.togglePlay(), [engine]);
  const setPlaybackRate = useCallback(
    (rate: number) => engine.setPlaybackRate(rate),
    [engine],
  );

  return {
    snapshot,
    currentFrame,
    loadManifest,
    setCameraIndex,
    setFrameIndex,
    stepFrame,
    play,
    pause,
    togglePlay,
    setPlaybackRate,
  };
}
