import { useMemo, useState } from "react";
import { PlayerView } from "./components/PlayerView";
import { useCatalog } from "./hooks/useCatalog";

export default function App() {
  const { catalog, loading, error } = useCatalog();
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedTechniqueId, setSelectedTechniqueId] = useState<string | null>(
    null,
  );
  const [filter, setFilter] = useState("");

  const selectedPlayer = useMemo(
    () => catalog?.players.find((player) => player.id === selectedPlayerId) ?? null,
    [catalog, selectedPlayerId],
  );

  const selectedTechnique = useMemo(
    () =>
      selectedPlayer?.techniques.find(
        (technique) => technique.id === selectedTechniqueId,
      ) ?? null,
    [selectedPlayer, selectedTechniqueId],
  );

  const filteredCatalog = useMemo(() => {
    if (!catalog) {
      return null;
    }

    const query = filter.trim().toLowerCase();
    if (!query) {
      return catalog;
    }

    return {
      players: catalog.players.map((player) => ({
        ...player,
        techniques: player.techniques.filter((technique) =>
          `${technique.title} ${technique.id}`.toLowerCase().includes(query),
        ),
      })),
    };
  }, [catalog, filter]);

  if (loading) {
    return <div className="app-shell loading-state">Loading catalog...</div>;
  }

  if (error || !catalog || !filteredCatalog) {
    return (
      <div className="app-shell loading-state">
        {error ?? "Catalog is unavailable"}
      </div>
    );
  }

  if (!selectedPlayerId || !selectedTechnique || !selectedPlayer) {
    const totalTechniques = catalog.players.reduce(
      (count, player) => count + player.techniques.length,
      0,
    );

    return (
      <div className="app-shell catalog-layout">
        <header className="catalog-header">
          <div>
            <p className="eyebrow">Table Tennis 4D Viewer</p>
            <h1>Select a technique</h1>
            <p>
              Biba local demo · {totalTechniques} techniques · manifest + on-disk
              assets
            </p>
          </div>
        </header>

        <label className="catalog-search">
          <span>Search</span>
          <input
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="FH Loop, Tomahawk, Serve..."
          />
        </label>

        <div className="catalog-grid">
          {filteredCatalog.players.map((player) => (
            <section key={player.id} className="player-card">
              <h2>
                {player.name}
                <span className="technique-count">{player.techniques.length}</span>
              </h2>
              {player.techniques.length === 0 ? (
                <p className="empty-state">No techniques match your search.</p>
              ) : (
                <ul>
                  {player.techniques.map((technique) => (
                    <li key={technique.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPlayerId(player.id);
                          setSelectedTechniqueId(technique.id);
                        }}
                      >
                        <span>{technique.title}</span>
                        <span className="technique-id">{technique.id}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <button
        type="button"
        className="back-button"
        onClick={() => {
          setSelectedTechniqueId(null);
        }}
      >
        ← Back to catalog
      </button>
      <PlayerView
        technique={selectedTechnique}
        playerName={selectedPlayer.name}
      />
    </div>
  );
}
