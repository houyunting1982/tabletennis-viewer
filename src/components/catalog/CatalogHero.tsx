interface CatalogHeroProps {
  techniqueCount: number;
  cameraCount: number;
  playerCount: number;
}

export function CatalogHero({
  techniqueCount,
  cameraCount,
  playerCount,
}: CatalogHeroProps) {
  return (
    <section className="catalog-hero">
      <div className="catalog-hero-backdrop" aria-hidden="true" />
      <div className="catalog-hero-glow catalog-hero-glow-a" aria-hidden="true" />
      <div className="catalog-hero-glow catalog-hero-glow-b" aria-hidden="true" />

      <div className="catalog-hero-content">
        <p className="catalog-hero-eyebrow">Table Tennis Lab</p>
        <h1>
          Multi-angle
          <br />
          <span>technique library</span>
        </h1>
        <p className="catalog-hero-copy">
          Explore synchronized camera views of professional table tennis motion.
          Scrub time, switch angles, and study every frame.
        </p>

        <div className="catalog-hero-stats">
          <div className="catalog-stat">
            <strong>{techniqueCount}</strong>
            <span>Techniques</span>
          </div>
          <div className="catalog-stat">
            <strong>{cameraCount}</strong>
            <span>Cameras</span>
          </div>
          <div className="catalog-stat">
            <strong>{playerCount}</strong>
            <span>Players</span>
          </div>
        </div>

        <div className="catalog-hero-footnote">
          <span>24 synchronized views</span>
          <span>Frame-accurate playback</span>
        </div>
      </div>
    </section>
  );
}
