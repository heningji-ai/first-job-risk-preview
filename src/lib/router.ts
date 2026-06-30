import { useEffect, useMemo, useState } from "react";

export type Route =
  | { name: "home"; path: "/" }
  | { name: "test"; path: "/test" }
  | { name: "result"; path: string; testSessionId: string }
  | { name: "not_found"; path: string };

function parsePath(path: string): Route {
  if (path === "/") return { name: "home", path };
  if (path === "/test") return { name: "test", path };

  const resultMatch = path.match(/^\/result\/([^/]+)$/);
  if (resultMatch) {
    return { name: "result", path, testSessionId: decodeURIComponent(resultMatch[1]) };
  }

  return { name: "not_found", path };
}

export function navigateTo(path: string): void {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function useRoute(): Route {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  return useMemo(() => parsePath(path), [path]);
}
