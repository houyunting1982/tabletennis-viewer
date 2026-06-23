import { useEffect, useState } from "react";
import type { Catalog } from "../lib/playback";

const catalogUrl = import.meta.env.VITE_CATALOG_URL ?? "/catalog.json";

export function useCatalog() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(catalogUrl);
        if (!response.ok) {
          throw new Error(`Failed to load catalog (${response.status})`);
        }

        const data = (await response.json()) as Catalog;
        if (!cancelled) {
          setCatalog(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load catalog");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { catalog, loading, error };
}
