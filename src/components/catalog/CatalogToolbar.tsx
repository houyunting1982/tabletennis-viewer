import { CATEGORY_META, CATEGORY_ORDER, type TechniqueCategory } from "../../lib/catalog/categories";

interface CatalogToolbarProps {
  query: string;
  category: TechniqueCategory;
  counts: Record<TechniqueCategory, number>;
  onQueryChange: (value: string) => void;
  onCategoryChange: (category: TechniqueCategory) => void;
}

export function CatalogToolbar({
  query,
  category,
  counts,
  onQueryChange,
  onCategoryChange,
}: CatalogToolbarProps) {
  const filters: TechniqueCategory[] = ["all", ...CATEGORY_ORDER];

  return (
    <div className="catalog-toolbar">
      <label className="catalog-search-field">
        <span className="catalog-search-icon" aria-hidden="true">
          ⌕
        </span>
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search loops, serves, footwork..."
        />
      </label>

      <div className="catalog-filter-row" role="tablist" aria-label="Technique categories">
        {filters.map((filter) => {
          const label =
            filter === "all"
              ? "All"
              : CATEGORY_META[filter].label;

          return (
            <button
              key={filter}
              type="button"
              role="tab"
              aria-selected={category === filter}
              className={`catalog-filter-pill ${category === filter ? "is-active" : ""}`}
              onClick={() => onCategoryChange(filter)}
            >
              <span>{label}</span>
              <span className="catalog-filter-count">{counts[filter]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
