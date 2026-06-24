import { useEffect, useMemo } from "react";
import { CatalogPage } from "./components/catalog/CatalogPage";
import { PlayerLibraryPage } from "./components/catalog/PlayerLibraryPage";
import { PlayerView } from "./components/PlayerView";
import { useAppRoute } from "./hooks/useAppRoute";
import { useCatalog } from "./hooks/useCatalog";
import { findPlayer, findTechnique } from "./lib/catalog/utils";
import { routeTitle } from "./lib/routing";

export default function App() {
  const { catalog, loading, error } = useCatalog();
  const { route, navigate } = useAppRoute();

  const selection = useMemo(() => {
    if (!catalog || route.view !== "technique") {
      return null;
    }

    return findTechnique(catalog, route.playerId, route.techniqueId);
  }, [catalog, route]);

  const playerPage = useMemo(() => {
    if (!catalog || route.view !== "player") {
      return null;
    }

    return findPlayer(catalog, route.playerId);
  }, [catalog, route]);

  useEffect(() => {
    if (route.view === "technique" && selection) {
      document.title = routeTitle(route, {
        playerName: selection.player.name,
        techniqueTitle: selection.technique.title,
      });
      return;
    }

    if (route.view === "player" && playerPage) {
      document.title = routeTitle(route, { playerName: playerPage.name });
      return;
    }

    document.title = routeTitle({ view: "home" });
  }, [route, selection, playerPage]);

  useEffect(() => {
    if (!catalog || route.view !== "technique") {
      return;
    }

    if (!selection) {
      navigate({ view: "player", playerId: route.playerId }, { replace: true });
    }
  }, [catalog, navigate, route, selection]);

  useEffect(() => {
    if (!catalog || route.view !== "player") {
      return;
    }

    if (!playerPage) {
      navigate({ view: "home" }, { replace: true });
    }
  }, [catalog, navigate, playerPage, route]);

  if (loading) {
    return (
      <div className="app-shell catalog-loading">
        <div className="catalog-loading-card">
          <div className="catalog-loading-spinner" />
          <p>Loading technique library...</p>
        </div>
      </div>
    );
  }

  if (error || !catalog) {
    return (
      <div className="app-shell catalog-loading">
        <div className="catalog-loading-card is-error">
          <p>{error ?? "Catalog is unavailable"}</p>
        </div>
      </div>
    );
  }

  if (route.view === "technique" && selection) {
    return (
      <div className="app-shell app-shell--player">
        <PlayerView
          technique={selection.technique}
          playerName={selection.player.name}
          onNavigateHome={() => navigate({ view: "home" })}
          onNavigatePlayer={() =>
            navigate({ view: "player", playerId: selection.player.id })
          }
        />
      </div>
    );
  }

  if (route.view === "player" && playerPage) {
    return (
      <div className="app-shell app-shell--catalog">
        <CatalogPage
          catalog={catalog}
          playerId={playerPage.id}
          onNavigateHome={() => navigate({ view: "home" })}
          onSelectTechnique={(playerId, techniqueId) =>
            navigate({ view: "technique", playerId, techniqueId })
          }
        />
      </div>
    );
  }

  return (
    <div className="app-shell app-shell--catalog">
      <PlayerLibraryPage
        catalog={catalog}
        onSelectPlayer={(playerId) => navigate({ view: "player", playerId })}
      />
    </div>
  );
}
