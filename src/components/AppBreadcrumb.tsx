interface AppBreadcrumbProps {
  items: Array<{
    label: string;
    onClick?: () => void;
    current?: boolean;
  }>;
}

export function AppBreadcrumb({ items }: AppBreadcrumbProps) {
  return (
    <nav className="app-breadcrumb" aria-label="Breadcrumb">
      <ol className="app-breadcrumb-list">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="app-breadcrumb-item">
            {item.current || !item.onClick ? (
              <span
                className={
                  item.current
                    ? "app-breadcrumb-current"
                    : "app-breadcrumb-label"
                }
                aria-current={item.current ? "page" : undefined}
              >
                {item.label}
              </span>
            ) : (
              <button
                type="button"
                className="app-breadcrumb-link"
                onClick={item.onClick}
              >
                {item.label}
              </button>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
