export type AppRoute =
  | { view: "home" }
  | { view: "player"; playerId: string }
  | { view: "technique"; playerId: string; techniqueId: string };

export function parseRoute(pathname: string): AppRoute {
  const segments = pathname.replace(/\/+$/, "").split("/").filter(Boolean);

  if (segments.length === 0) {
    return { view: "home" };
  }

  if (segments[0] !== "players") {
    return { view: "home" };
  }

  const playerId = segments[1];
  if (!playerId) {
    return { view: "home" };
  }

  const techniqueId = segments[2];
  if (!techniqueId) {
    return { view: "player", playerId };
  }

  return { view: "technique", playerId, techniqueId };
}

export function routeToPath(route: AppRoute): string {
  switch (route.view) {
    case "home":
      return "/";
    case "player":
      return `/players/${encodeURIComponent(route.playerId)}`;
    case "technique":
      return `/players/${encodeURIComponent(route.playerId)}/${encodeURIComponent(route.techniqueId)}`;
  }
}

export function buildHomePath(): string {
  return "/";
}

export function buildPlayerPath(playerId: string): string {
  return `/players/${encodeURIComponent(playerId)}`;
}

export function buildTechniquePath(playerId: string, techniqueId: string): string {
  return `/players/${encodeURIComponent(playerId)}/${encodeURIComponent(techniqueId)}`;
}

export function routeTitle(route: AppRoute, labels?: {
  playerName?: string;
  techniqueTitle?: string;
}): string {
  const base = "Table Tennis Lab";

  switch (route.view) {
    case "home":
      return base;
    case "player":
      return labels?.playerName ? `${labels.playerName} · ${base}` : base;
    case "technique":
      if (labels?.techniqueTitle && labels?.playerName) {
        return `${labels.techniqueTitle} · ${labels.playerName} · ${base}`;
      }
      return base;
  }
}
