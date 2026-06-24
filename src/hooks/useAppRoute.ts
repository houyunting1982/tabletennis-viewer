import { useCallback, useEffect, useState } from "react";
import {
  parseRoute,
  routeToPath,
  type AppRoute,
} from "../lib/routing";

export function useAppRoute() {
  const [route, setRoute] = useState<AppRoute>(() =>
    parseRoute(window.location.pathname),
  );

  useEffect(() => {
    const onPopState = () => {
      setRoute(parseRoute(window.location.pathname));
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback((next: AppRoute, options?: { replace?: boolean }) => {
    const path = routeToPath(next);
    if (path === window.location.pathname) {
      setRoute(next);
      return;
    }

    if (options?.replace) {
      window.history.replaceState(null, "", path);
    } else {
      window.history.pushState(null, "", path);
    }

    setRoute(next);
  }, []);

  return { route, navigate };
}
