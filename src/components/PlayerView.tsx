import { useEffect } from "react";
import { BufferingOverlay } from "./BufferingOverlay";
import { ControlPanel } from "./ControlPanel";
import { DisplayCanvas } from "./DisplayCanvas";
import { useDelayedVisible } from "../hooks/useDelayedVisible";
import { usePlayback } from "../hooks/usePlayback";
import type { CatalogTechnique } from "../lib/playback";

interface PlayerViewProps {
  technique: CatalogTechnique;
  playerName: string;
}

export function PlayerView({ technique, playerName }: PlayerViewProps) {
  const {
    snapshot,
    currentFrame,
    loadManifest,
    setCameraIndex,
    setFrameIndex,
    stepFrame,
    togglePlay,
    setPlaybackRate,
  } = usePlayback();

  useEffect(() => {
    void loadManifest(technique.manifestUrl);
  }, [loadManifest, technique.manifestUrl]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) {
        return;
      }

      switch (event.code) {
        case "ArrowRight":
          event.preventDefault();
          setCameraIndex(snapshot.cameraIndex + 1);
          break;
        case "ArrowLeft":
          event.preventDefault();
          setCameraIndex(snapshot.cameraIndex - 1);
          break;
        case "ArrowUp":
          event.preventDefault();
          stepFrame(1);
          break;
        case "ArrowDown":
          event.preventDefault();
          stepFrame(-1);
          break;
        case "Space":
          event.preventDefault();
          togglePlay();
          break;
        case "Digit1":
        case "Numpad1":
          setPlaybackRate(1);
          break;
        case "Digit2":
        case "Numpad2":
          setPlaybackRate(0.5);
          break;
        case "Digit3":
        case "Numpad3":
          setPlaybackRate(0.25);
          break;
        case "Digit4":
        case "Numpad4":
          setPlaybackRate(0.1);
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    setCameraIndex,
    setPlaybackRate,
    snapshot.cameraIndex,
    stepFrame,
    togglePlay,
  ]);

  const waitingForCurrentSlice =
    snapshot.status === "ready" &&
    currentFrame === null &&
    snapshot.bufferProgress < snapshot.bufferTotal;
  const isBuffering =
    snapshot.status === "loading_manifest" ||
    snapshot.status === "loading_camera" ||
    waitingForCurrentSlice;
  const showBufferingOverlay = useDelayedVisible(isBuffering, 300);

  return (
    <section className="player-view">
      <header className="player-header">
        <div>
          <p className="eyebrow">{playerName}</p>
          <h1>{technique.title}</h1>
        </div>
        <p className="status-pill">{snapshot.status}</p>
      </header>

      <div className="player-stage">
        <DisplayCanvas
          frame={currentFrame}
          isPlaying={snapshot.status === "playing"}
        />
        <BufferingOverlay
          visible={showBufferingOverlay}
          progress={snapshot.bufferProgress}
          total={snapshot.bufferTotal}
          label={
            snapshot.status === "loading_manifest"
              ? "Loading manifest"
              : `Loading frame ${Math.min(snapshot.bufferProgress + 1, snapshot.bufferTotal)} / ${snapshot.bufferTotal} · all ${snapshot.cameraCount} cameras`
          }
        />
      </div>

      {snapshot.error && <p className="error-banner">{snapshot.error}</p>}

      <ControlPanel
        isPlaying={snapshot.status === "playing"}
        canPlay={snapshot.status === "ready" || snapshot.status === "playing"}
        frameIndex={snapshot.frameIndex}
        frameCount={snapshot.frameCount}
        cameraIndex={snapshot.cameraIndex}
        cameraCount={snapshot.cameraCount}
        playbackRate={snapshot.playbackRate}
        onTogglePlay={togglePlay}
        onPrevFrame={() => stepFrame(-1)}
        onNextFrame={() => stepFrame(1)}
        onPrevCamera={() => setCameraIndex(snapshot.cameraIndex - 1)}
        onNextCamera={() => setCameraIndex(snapshot.cameraIndex + 1)}
        onSetPlaybackRate={setPlaybackRate}
        onSeek={setFrameIndex}
      />

      <p className="help-text">
        Arrow keys: switch camera / step frames. Space: play or pause. 1-4: speed.
      </p>
    </section>
  );
}
