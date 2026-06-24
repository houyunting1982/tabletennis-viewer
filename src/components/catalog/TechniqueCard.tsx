import type { CSSProperties } from "react";
import {
  CATEGORY_META,
  extractTechniqueNumber,
  type TechniqueCategory,
} from "../../lib/catalog/categories";
import type { EnrichedTechnique } from "../../lib/catalog/utils";

interface TechniqueCardProps {
  technique: EnrichedTechnique;
  onSelect: (playerId: string, techniqueId: string) => void;
}

export function TechniqueCard({ technique, onSelect }: TechniqueCardProps) {
  const category = technique.category as Exclude<TechniqueCategory, "all">;
  const meta = CATEGORY_META[category];
  const number = extractTechniqueNumber(technique.id);

  return (
    <button
      type="button"
      className="technique-card"
      style={{ "--card-accent": meta.accent } as CSSProperties}
      onClick={() => onSelect(technique.playerId, technique.id)}
    >
      <div className="technique-card-media">
        {technique.previewUrl ? (
          <img
            src={technique.previewUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="technique-card-image"
          />
        ) : (
          <div className="technique-card-fallback" aria-hidden="true">
            <span>{number || meta.label.slice(0, 2).toUpperCase()}</span>
          </div>
        )}
        <div className="technique-card-overlay" />
        <span className="technique-card-chip">{meta.label}</span>
        <span className="technique-card-play" aria-hidden="true">
          ▶
        </span>
      </div>

      <div className="technique-card-body">
        <div className="technique-card-meta">
          {number && <span className="technique-card-number">#{number}</span>}
          {technique.frameCount && (
            <span className="technique-card-stat">{technique.frameCount} frames</span>
          )}
        </div>
        <h3>{technique.title}</h3>
      </div>
    </button>
  );
}
