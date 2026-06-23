interface BufferingOverlayProps {
  visible: boolean;
  progress: number;
  total: number;
  label: string;
}

export function BufferingOverlay({
  visible,
  progress,
  total,
  label,
}: BufferingOverlayProps) {
  if (!visible) {
    return null;
  }

  const percent = total > 0 ? Math.round((progress / total) * 100) : 0;

  return (
    <div className="buffering-overlay">
      <div className="buffering-card">
        <p className="buffering-title">{label}</p>
        <p className="buffering-progress">
          {progress} / {total} frames ({percent}%)
        </p>
        <div className="buffering-bar">
          <div
            className="buffering-bar-fill"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
