import { useEffect, useMemo } from "react";
import { AppBreadcrumb } from "./AppBreadcrumb";
import { BufferingOverlay } from "./BufferingOverlay";
import { CameraBufferPanel } from "./CameraBufferPanel";
import { ControlPanel } from "./ControlPanel";
import { DisplayCanvas } from "./DisplayCanvas";
import { useDelayedVisible } from "../hooks/useDelayedVisible";
import { usePlayback } from "../hooks/usePlayback";
import type { CatalogTechnique, PlaybackStatus } from "../lib/playback";

interface PlayerViewProps {
  technique: CatalogTechnique;
  playerName: string;
  onNavigateHome: () => void;
  onNavigatePlayer: () => void;
}

function getStageStatusLabel(
  status: PlaybackStatus,
  cameraIndex: number,
  frameIndex: number,
  frameCount: number,
): string | null {
  switch (status) {
    case "ready":
      return `Paused · C${cameraIndex + 1} · Frame ${frameIndex + 1}/${frameCount}`;
    case "buffering":
      return `Buffering · C${cameraIndex + 1} · Frame ${frameIndex + 1}/${frameCount}`;
    default:
      return null;
  }
}

function releaseControlFocus() {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) {
    return;
  }

  if (
    active.closest(".camera-buffer-grid, .control-panel, .transport-row, .speed-segment")
  ) {
    active.blur();
  }
}

export function PlayerView({
  technique,
  playerName,
  onNavigateHome,
  onNavigatePlayer,
}: PlayerViewProps) {
  const {
    snapshot,
    currentFrame,
    loadManifest,
    setCameraIndex,
    stepCamera,
    setFrameIndex,
    stepFrame,
    togglePlay,
    setPlaybackRate,
  } = usePlayback();

  useEffect(() => {
    void loadManifest(technique.manifestUrl);
  }, [loadManifest, technique.manifestUrl]);

  const readyCameraIndices = useMemo(
    () =>
      snapshot.cameraProgress
        .filter((camera) => camera.complete)
        .map((camera) => camera.index),
    [snapshot.cameraProgress],
  );

  const canStepPrevCamera = readyCameraIndices.some(
    (index) => index < snapshot.cameraIndex,
  );
  const canStepNextCamera = readyCameraIndices.some(
    (index) => index > snapshot.cameraIndex,
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) {
        return;
      }

      switch (event.code) {
        case "ArrowRight":
          if (!canStepNextCamera) {
            return;
          }
          event.preventDefault();
          stepCamera(1);
          releaseControlFocus();
          break;
        case "ArrowLeft":
          if (!canStepPrevCamera) {
            return;
          }
          event.preventDefault();
          stepCamera(-1);
          releaseControlFocus();
          break;
        case "ArrowUp":
          event.preventDefault();
          stepFrame(1);
          releaseControlFocus();
          break;
        case "ArrowDown":
          event.preventDefault();
          stepFrame(-1);
          releaseControlFocus();
          break;
        case "Space":
          event.preventDefault();
          togglePlay();
          releaseControlFocus();
          break;
        case "Digit1":
        case "Numpad1":
          setPlaybackRate(1);
          releaseControlFocus();
          break;
        case "Digit2":
        case "Numpad2":
          setPlaybackRate(0.5);
          releaseControlFocus();
          break;
        case "Digit3":
        case "Numpad3":
          setPlaybackRate(0.25);
          releaseControlFocus();
          break;
        case "Digit4":
        case "Numpad4":
          setPlaybackRate(0.1);
          releaseControlFocus();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    canStepNextCamera,
    canStepPrevCamera,
    setPlaybackRate,
    stepCamera,
    stepFrame,
    togglePlay,
  ]);

  const isPlaying = snapshot.status === "playing";
  const waitingForPrimaryCamera =
    snapshot.status === "ready" &&
    currentFrame === null &&
    !snapshot.canPlay;
  const showInitialOverlay =
    snapshot.status === "loading_manifest" ||
    (snapshot.status === "loading_camera" && !snapshot.canPlay) ||
    waitingForPrimaryCamera;
  const showBufferingOverlay = useDelayedVisible(showInitialOverlay, 300);
  const primaryPercent =
    snapshot.cameraBufferTotal > 0
      ? Math.round(
          (snapshot.cameraBufferProgress / snapshot.cameraBufferTotal) * 100,
        )
      : 0;
  const stageStatusLabel = getStageStatusLabel(
    snapshot.status,
    snapshot.cameraIndex,
    snapshot.frameIndex,
    snapshot.frameCount,
  );

  return (
    <section className="player-view">
      <header className="player-header">
        <AppBreadcrumb
          items={[
            { label: "Library", onClick: onNavigateHome },
            { label: playerName, onClick: onNavigatePlayer },
          ]}
        />
      </header>

      <div className="player-visual-stack">
        <div className="player-stage">
          <DisplayCanvas frame={currentFrame} isPlaying={isPlaying} />
          <BufferingOverlay
            visible={showBufferingOverlay}
            progress={snapshot.cameraBufferProgress}
            total={snapshot.cameraBufferTotal}
            label={
              snapshot.status === "loading_manifest"
                ? "Loading manifest"
                : `Loading Camera 1 · ${primaryPercent}%`
            }
          />
          {stageStatusLabel && (
            <div className="player-stage-status-bar">{stageStatusLabel}</div>
          )}
        </div>

        <CameraBufferPanel
          cameras={snapshot.cameraProgress}
          selectedCameraIndex={snapshot.cameraIndex}
          onSelectCamera={setCameraIndex}
          bufferProgress={snapshot.bufferProgress}
          bufferTotal={snapshot.bufferTotal}
          docked
        />
      </div>

      <div className="player-video-meta">
        <h1 className="player-video-title">{technique.title}</h1>
        <p className="player-video-subtitle">
          {playerName}
          {snapshot.frameCount > 0 && (
            <>
              {" "}
              · {snapshot.frameCount} frames · Camera {snapshot.cameraIndex + 1}
            </>
          )}
        </p>
      </div>

      {snapshot.error && <p className="error-banner">{snapshot.error}</p>}

      <ControlPanel
        isPlaying={isPlaying}
        isBuffering={snapshot.status === "buffering"}
        canPlay={snapshot.canPlay}
        frameIndex={snapshot.frameIndex}
        frameCount={snapshot.frameCount}
        playbackRate={snapshot.playbackRate}
        onTogglePlay={togglePlay}
        onPrevFrame={() => stepFrame(-1)}
        onNextFrame={() => stepFrame(1)}
        onSetPlaybackRate={setPlaybackRate}
        onSeek={setFrameIndex}
      />
    </section>
  );
}
