import { useMemo, useState } from "react";
import type { Catalog } from "../../lib/playback/types";
import { AppBreadcrumb } from "../AppBreadcrumb";
import {
  CATEGORY_META,
  type TechniqueCategory,
} from "../../lib/catalog/categories";
import {
  enrichCatalog,
  filterTechniques,
  findPlayer,
  getCatalogStats,
  groupByCategory,
} from "../../lib/catalog/utils";
import { CatalogHero } from "./CatalogHero";
import { CatalogToolbar } from "./CatalogToolbar";
import { TechniqueCard } from "./TechniqueCard";

interface CatalogPageProps {
  catalog: Catalog;
  playerId?: string;
  onSelectTechnique: (playerId: string, techniqueId: string) => void;
  onNavigateHome?: () => void;
}

export function CatalogPage({
  catalog,
  playerId,
  onSelectTechnique,
  onNavigateHome,
}: CatalogPageProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<TechniqueCategory>("all");

  const player = useMemo(
    () => (playerId ? findPlayer(catalog, playerId) : null),
    [catalog, playerId],
  );

  const techniques = useMemo(() => {
    const all = enrichCatalog(catalog);
    if (!playerId) {
      return all;
    }
    return all.filter((technique) => technique.playerId === playerId);
  }, [catalog, playerId]);

  const stats = useMemo(() => getCatalogStats(catalog), [catalog]);

  const filteredTechniques = useMemo(
    () => filterTechniques(techniques, query, category),
    [techniques, query, category],
  );

  const groupedTechniques = useMemo(
    () => groupByCategory(filteredTechniques),
    [filteredTechniques],
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<TechniqueCategory, number> = {
      all: techniques.length,
      forehand: 0,
      backhand: 0,
      serve: 0,
      footwork: 0,
      fundamentals: 0,
    };

    for (const technique of techniques) {
      counts[technique.category] += 1;
    }

    return counts;
  }, [techniques]);

  const playerTechniqueCount = techniques.length;

  return (
    <div className="catalog-page">
      {player ? (
        <header className="player-catalog-header">
          <AppBreadcrumb
            items={[
              {
                label: "Library",
                onClick: onNavigateHome,
              },
              {
                label: player.name,
                current: true,
              },
            ]}
          />
          <div className="player-catalog-header-copy">
            <p className="eyebrow">{player.name}</p>
            <h1>Technique library</h1>
            <p className="player-catalog-header-meta">
              {playerTechniqueCount} techniques · {stats.cameraCount} cameras
            </p>
          </div>
        </header>
      ) : (
        <CatalogHero
          techniqueCount={stats.techniqueCount}
          cameraCount={stats.cameraCount}
          playerCount={stats.playerCount}
        />
      )}

      <div className="catalog-page-body">
        <CatalogToolbar
          query={query}
          category={category}
          counts={categoryCounts}
          onQueryChange={setQuery}
          onCategoryChange={setCategory}
        />

        {filteredTechniques.length === 0 ? (
          <div className="catalog-empty">
            <h2>No techniques found</h2>
            <p>Try another search term or clear the category filter.</p>
          </div>
        ) : category === "all" && !query.trim() ? (
          groupedTechniques.map(({ category: sectionCategory, techniques: sectionTechniques }) => {
            const meta = CATEGORY_META[sectionCategory];

            return (
              <section key={sectionCategory} className="catalog-section">
                <div className="catalog-section-header">
                  <div>
                    <p className="catalog-section-kicker">{meta.label}</p>
                    <h2>{meta.description}</h2>
                  </div>
                  <span className="catalog-section-count">
                    {sectionTechniques.length}
                  </span>
                </div>

                <div className="technique-grid">
                  {sectionTechniques.map((technique) => (
                    <TechniqueCard
                      key={technique.id}
                      technique={technique}
                      onSelect={onSelectTechnique}
                    />
                  ))}
                </div>
              </section>
            );
          })
        ) : (
          <section className="catalog-section">
            <div className="catalog-section-header">
              <div>
                <p className="catalog-section-kicker">Results</p>
                <h2>
                  {filteredTechniques.length} technique
                  {filteredTechniques.length === 1 ? "" : "s"} matched
                </h2>
              </div>
            </div>

            <div className="technique-grid">
              {filteredTechniques.map((technique) => (
                <TechniqueCard
                  key={technique.id}
                  technique={technique}
                  onSelect={onSelectTechnique}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
