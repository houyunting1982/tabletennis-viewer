import type { Catalog, CatalogPlayer } from "../../lib/playback/types";
import { CatalogHero } from "./CatalogHero";
import { PlayerCard } from "./PlayerCard";

interface PlayerLibraryPageProps {
  catalog: Catalog;
  onSelectPlayer: (playerId: string) => void;
}

function getPlayerPreviewUrl(player: CatalogPlayer): string | undefined {
  return player.techniques.find((technique) => technique.previewUrl)?.previewUrl;
}

export function PlayerLibraryPage({
  catalog,
  onSelectPlayer,
}: PlayerLibraryPageProps) {
  const techniqueCount = catalog.players.reduce(
    (total, player) => total + player.techniques.length,
    0,
  );
  const cameraCount = catalog.players[0]?.techniques[0]?.cameraCount ?? 24;

  return (
    <div className="catalog-page">
      <CatalogHero
        techniqueCount={techniqueCount}
        cameraCount={cameraCount}
        playerCount={catalog.players.length}
      />

      <div className="catalog-page-body">
        <section className="player-library-section">
          <div className="catalog-section-header">
            <div>
              <p className="catalog-section-kicker">Players</p>
              <h2>Choose a player to explore their technique library</h2>
            </div>
          </div>

          <div className="player-grid">
            {catalog.players.map((player) => (
              <PlayerCard
                key={player.id}
                player={player}
                previewUrl={getPlayerPreviewUrl(player)}
                onSelect={onSelectPlayer}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
