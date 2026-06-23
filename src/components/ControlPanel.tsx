interface ControlPanelProps {
  isPlaying: boolean;
  canPlay: boolean;
  frameIndex: number;
  frameCount: number;
  cameraIndex: number;
  cameraCount: number;
  playbackRate: number;
  onTogglePlay: () => void;
  onPrevFrame: () => void;
  onNextFrame: () => void;
  onPrevCamera: () => void;
  onNextCamera: () => void;
  onSetPlaybackRate: (rate: number) => void;
  onSeek: (index: number) => void;
}

const SPEED_OPTIONS = [
  { label: "100%", rate: 1 },
  { label: "50%", rate: 0.5 },
  { label: "25%", rate: 0.25 },
  { label: "10%", rate: 0.1 },
];

export function ControlPanel({
  isPlaying,
  canPlay,
  frameIndex,
  frameCount,
  cameraIndex,
  cameraCount,
  playbackRate,
  onTogglePlay,
  onPrevFrame,
  onNextFrame,
  onPrevCamera,
  onNextCamera,
  onSetPlaybackRate,
  onSeek,
}: ControlPanelProps) {
  const maxFrameIndex = Math.max(frameCount - 1, 0);

  return (
    <div className="control-panel">
      <div className="control-row">
        <button
          type="button"
          onClick={onPrevCamera}
          disabled={cameraIndex <= 0}
        >
          ◀ Camera
        </button>
        <button
          type="button"
          onClick={onPrevFrame}
          disabled={frameIndex <= 0}
        >
          ◀ Frame
        </button>
        <button type="button" onClick={onTogglePlay} disabled={!canPlay}>
          {isPlaying ? "Pause" : "Play"}
        </button>
        <button
          type="button"
          onClick={onNextFrame}
          disabled={frameIndex >= maxFrameIndex}
        >
          Frame ▶
        </button>
        <button
          type="button"
          onClick={onNextCamera}
          disabled={cameraIndex >= cameraCount - 1}
        >
          Camera ▶
        </button>
      </div>

      <div className="control-meta">
        <span>
          Camera {cameraIndex + 1} / {cameraCount}
        </span>
        <span>
          Frame {frameIndex + 1} / {frameCount}
        </span>
      </div>

      <label className="scrubber">
        <span>Timeline</span>
        <input
          type="range"
          min={0}
          max={maxFrameIndex}
          value={frameIndex}
          onChange={(event) => onSeek(Number(event.target.value))}
          disabled={frameCount === 0}
        />
      </label>

      <div className="speed-row">
        {SPEED_OPTIONS.map((option) => (
          <button
            key={option.label}
            type="button"
            className={playbackRate === option.rate ? "is-active" : ""}
            onClick={() => onSetPlaybackRate(option.rate)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
