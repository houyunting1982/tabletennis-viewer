import type { CatalogPlayer } from "../../lib/playback/types";

interface PlayerCardProps {
  player: CatalogPlayer;
  previewUrl?: string;
  onSelect: (playerId: string) => void;
}

export function PlayerCard({ player, previewUrl, onSelect }: PlayerCardProps) {
  const techniqueCount = player.techniques.length;
  const cameraCount = player.techniques[0]?.cameraCount ?? 24;

  return (
    <button
      type="button"
      className="player-card"
      onClick={() => onSelect(player.id)}
    >
      <div className="player-card-media">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="player-card-image"
          />
        ) : (
          <div className="player-card-fallback" aria-hidden="true">
            <span>{player.name.slice(0, 1)}</span>
          </div>
        )}
        <div className="player-card-overlay" />
        <span className="player-card-chip">{techniqueCount} techniques</span>
      </div>

      <div className="player-card-body">
        <p className="player-card-eyebrow">Player</p>
        <h3>{player.name}</h3>
        <p className="player-card-meta">{cameraCount} cameras · frame-accurate playback</p>
      </div>
    </button>
  );
}
