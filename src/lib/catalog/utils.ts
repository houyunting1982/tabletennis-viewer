import type { Catalog, CatalogPlayer, CatalogTechnique } from "../playback/types";
import {
  categorizeTechnique,
  CATEGORY_ORDER,
  type TechniqueCategory,
} from "./categories";

export interface EnrichedTechnique extends CatalogTechnique {
  category: Exclude<TechniqueCategory, "all">;
  playerId: string;
  playerName: string;
}

export function enrichCatalog(catalog: Catalog): EnrichedTechnique[] {
  const techniques: EnrichedTechnique[] = [];

  for (const player of catalog.players) {
    for (const technique of player.techniques) {
      techniques.push({
        ...technique,
        playerId: player.id,
        playerName: player.name,
        category: categorizeTechnique(technique),
      });
    }
  }

  return techniques.sort((a, b) =>
    a.id.localeCompare(b.id, undefined, { numeric: true }),
  );
}

export function filterTechniques(
  techniques: EnrichedTechnique[],
  query: string,
  category: TechniqueCategory,
): EnrichedTechnique[] {
  const normalizedQuery = query.trim().toLowerCase();

  return techniques.filter((technique) => {
    const matchesCategory = category === "all" || technique.category === category;
    if (!matchesCategory) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return `${technique.title} ${technique.id} ${technique.category}`
      .toLowerCase()
      .includes(normalizedQuery);
  });
}

export function groupByCategory(
  techniques: EnrichedTechnique[],
): Array<{
  category: Exclude<TechniqueCategory, "all">;
  techniques: EnrichedTechnique[];
}> {
  return (CATEGORY_ORDER as Exclude<TechniqueCategory, "all">[]).map((category) => ({
    category,
    techniques: techniques.filter((technique) => technique.category === category),
  })).filter((group) => group.techniques.length > 0);
}

export function getCatalogStats(catalog: Catalog) {
  const techniques = enrichCatalog(catalog);
  const cameraCount = techniques[0]?.cameraCount ?? 24;

  return {
    techniqueCount: techniques.length,
    playerCount: catalog.players.length,
    cameraCount,
    categoryCount: CATEGORY_ORDER.length,
  };
}

export function findPlayer(
  catalog: Catalog,
  playerId: string,
): CatalogPlayer | null {
  return catalog.players.find((entry) => entry.id === playerId) ?? null;
}

export function findTechnique(
  catalog: Catalog,
  playerId: string,
  techniqueId: string,
): { player: CatalogPlayer; technique: CatalogTechnique } | null {
  const player = catalog.players.find((entry) => entry.id === playerId);
  const technique = player?.techniques.find((entry) => entry.id === techniqueId);

  if (!player || !technique) {
    return null;
  }

  return { player, technique };
}
