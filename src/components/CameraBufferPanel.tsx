import type { CameraLoadProgress } from "../lib/playback/types";

interface CameraBufferPanelProps {
  cameras: CameraLoadProgress[];
  selectedCameraIndex: number;
  onSelectCamera: (index: number) => void;
  bufferProgress: number;
  bufferTotal: number;
  docked?: boolean;
}

function cellStatus(camera: CameraLoadProgress): "ready" | "loading" | "waiting" {
  if (camera.complete) {
    return "ready";
  }
  if (camera.loaded > 0) {
    return "loading";
  }
  return "waiting";
}

function CameraIcon() {
  return (
    <svg
      className="camera-buffer-rail-icon"
      viewBox="0 0 24 24"
      width="14"
      height="14"
      aria-hidden="true"
    >
      <path
        d="M4 8h4l2-2h4l2 2h4v10H4V8z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="13"
        r="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
      />
    </svg>
  );
}

export function CameraBufferPanel({
  cameras,
  selectedCameraIndex,
  onSelectCamera,
  bufferProgress,
  bufferTotal,
  docked = false,
}: CameraBufferPanelProps) {
  if (cameras.length === 0) {
    return null;
  }

  const readyCount = cameras.filter((camera) => camera.complete).length;
  const allReady = readyCount === cameras.length;
  const overallPercent =
    bufferTotal > 0 ? Math.round((bufferProgress / bufferTotal) * 100) : 0;

  return (
    <section
      className={[
        "camera-buffer-panel",
        "camera-buffer-panel--compact",
        docked ? "camera-buffer-panel--dock" : "",
        allReady ? "camera-buffer-panel--all-ready" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-live="polite"
    >
      <div className="camera-buffer-rail-header">
        <div className="camera-buffer-rail-title">
          <CameraIcon />
          <span>Camera angles</span>
          <span className="camera-buffer-rail-range">C1–C{cameras.length}</span>
        </div>
        <span className="camera-buffer-rail-hint">
          {allReady
            ? "Click a tile to switch view"
            : `${readyCount}/${cameras.length} ready · ${overallPercent}%`}
        </span>
      </div>

      {!allReady && (
        <div className="camera-buffer-overall camera-buffer-overall--inline">
          <div className="camera-buffer-overall-bar">
            <div
              className="camera-buffer-overall-bar-fill"
              style={{ width: `${overallPercent}%` }}
            />
          </div>
        </div>
      )}

      <div className="camera-buffer-grid" role="listbox" aria-label="Camera angles">
        {cameras.map((camera) => {
          const percent =
            camera.total > 0
              ? Math.round((camera.loaded / camera.total) * 100)
              : 0;
          const status = cellStatus(camera);
          const isSelected = camera.index === selectedCameraIndex;
          const cameraNumber = camera.index + 1;

          return (
            <button
              key={camera.key}
              type="button"
              role="option"
              aria-selected={isSelected}
              aria-label={
                camera.complete
                  ? `Camera ${cameraNumber}`
                  : status === "loading"
                    ? `Camera ${cameraNumber} loading ${percent}%`
                    : `Camera ${cameraNumber} waiting`
              }
              disabled={!camera.complete}
              className={[
                "camera-buffer-cell",
                `is-${status}`,
                camera.complete ? "is-clickable" : "",
                isSelected ? "is-selected" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              title={
                camera.complete
                  ? `Switch to camera ${cameraNumber}`
                  : `Camera ${cameraNumber}: ${camera.loaded}/${camera.total} frames (${percent}%)`
              }
              onClick={(event) => {
                onSelectCamera(camera.index);
                event.currentTarget.blur();
              }}
            >
              <span className="camera-buffer-cell-label">{`C${cameraNumber}`}</span>
              {status === "loading" && (
                <>
                  <div className="camera-buffer-cell-loading">
                    <span className="camera-buffer-cell-spinner" aria-hidden="true" />
                    <span className="camera-buffer-cell-progress">{percent}%</span>
                  </div>
                  <div className="camera-buffer-cell-bar" aria-hidden="true">
                    <div
                      className="camera-buffer-cell-bar-fill"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
