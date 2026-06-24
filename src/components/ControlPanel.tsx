interface ControlPanelProps {
  isPlaying: boolean;
  isBuffering: boolean;
  canPlay: boolean;
  frameIndex: number;
  frameCount: number;
  playbackRate: number;
  onTogglePlay: () => void;
  onPrevFrame: () => void;
  onNextFrame: () => void;
  onSetPlaybackRate: (rate: number) => void;
  onSeek: (index: number) => void;
}

const SPEED_OPTIONS = [
  { label: "1×", rate: 1 },
  { label: "½×", rate: 0.5 },
  { label: "¼×", rate: 0.25 },
  { label: "⅒×", rate: 0.1 },
];

export function ControlPanel({
  isPlaying,
  isBuffering,
  canPlay,
  frameIndex,
  frameCount,
  playbackRate,
  onTogglePlay,
  onPrevFrame,
  onNextFrame,
  onSetPlaybackRate,
  onSeek,
}: ControlPanelProps) {
  const maxFrameIndex = Math.max(frameCount - 1, 0);

  return (
    <div className="control-panel control-panel--transport">
      <div className="transport-row">
        <div className="transport-buttons" aria-label="Playback controls">
          <button
            type="button"
            className="transport-icon-button"
            onClick={onPrevFrame}
            disabled={frameIndex <= 0}
            aria-label="Previous frame"
            title="Previous frame (↑)"
          >
            ◀
          </button>
          <button
            type="button"
            onClick={onTogglePlay}
            disabled={!canPlay && !isPlaying && !isBuffering}
            className={`transport-play-button ${isBuffering ? "is-buffering" : ""}`}
          >
            {isBuffering ? "Buffering…" : isPlaying ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            className="transport-icon-button"
            onClick={onNextFrame}
            disabled={frameIndex >= maxFrameIndex}
            aria-label="Next frame"
            title="Next frame (↓)"
          >
            ▶
          </button>
        </div>

        <label className="transport-scrubber">
          <div className="transport-scrubber-meta">
            <span>Timeline</span>
            <span>
              Frame {frameIndex + 1} / {frameCount}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={maxFrameIndex}
            value={frameIndex}
            onChange={(event) => onSeek(Number(event.target.value))}
            disabled={frameCount === 0}
          />
        </label>

        <div className="transport-speed" aria-label="Playback speed">
          <span className="transport-speed-label">Speed</span>
          <div className="speed-segment">
            {SPEED_OPTIONS.map((option) => (
              <button
                key={option.rate}
                type="button"
                className={playbackRate === option.rate ? "is-active" : ""}
                onClick={() => onSetPlaybackRate(option.rate)}
                title={`${option.label} speed`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
