import type { CatalogTechnique } from "../playback/types";

export type TechniqueCategory =
  | "all"
  | "forehand"
  | "backhand"
  | "serve"
  | "footwork"
  | "fundamentals";

export interface CategoryMeta {
  id: TechniqueCategory;
  label: string;
  description: string;
  accent: string;
}

export const CATEGORY_ORDER: TechniqueCategory[] = [
  "forehand",
  "backhand",
  "serve",
  "footwork",
  "fundamentals",
];

export const CATEGORY_META: Record<Exclude<TechniqueCategory, "all">, CategoryMeta> = {
  forehand: {
    id: "forehand",
    label: "Forehand",
    description: "Loops, drives, blocks, and attacks",
    accent: "#5ecf8f",
  },
  backhand: {
    id: "backhand",
    label: "Backhand",
    description: "Banana, strawberry, blocks, and lifts",
    accent: "#6cb4ff",
  },
  serve: {
    id: "serve",
    label: "Serve",
    description: "US, TS, and tomahawk serves",
    accent: "#f0b35a",
  },
  footwork: {
    id: "footwork",
    label: "Footwork",
    description: "Ready position, steps, and recovery",
    accent: "#c89bff",
  },
  fundamentals: {
    id: "fundamentals",
    label: "Fundamentals",
    description: "Core setup and rally basics",
    accent: "#8fd4c7",
  },
};

const FOOTWORK_IDS = new Set([
  "60-ready-position",
  "61-one-step",
  "62-turn",
  "63-recover-from-serve",
  "64-cross-step",
]);

export function categorizeTechnique(technique: CatalogTechnique): Exclude<TechniqueCategory, "all"> {
  if (technique.category) {
    return technique.category;
  }

  const { id, title } = technique;

  if (FOOTWORK_IDS.has(id)) {
    return "footwork";
  }

  if (id.startsWith("11-")) {
    return "fundamentals";
  }

  if (/serve|tomahawk/i.test(id) || /serve|tomahawk/i.test(title)) {
    return "serve";
  }

  if (/^(\d+[a-z]?-)?fh-/i.test(id) || title.startsWith("FH ") || /^(\d+[a-z]?-)?fh/i.test(title)) {
    return "forehand";
  }

  if (/^(\d+[a-z]?-)?bh-/i.test(id) || title.startsWith("BH ") || /bh/i.test(id)) {
    return "backhand";
  }

  return "forehand";
}

export function extractTechniqueNumber(id: string): string {
  const match = id.match(/^(\d+[a-z]?)/i);
  return match?.[1]?.toUpperCase() ?? "";
}
