import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";

export type Page = "landing" | "board" | "insights";

interface Location {
  page: Page;
  appId: number | null;
}

interface RouterValue extends Location {
  navigate(path: string, options?: { replace?: boolean }): void;
  openApplication(id: number | null, options?: { replace?: boolean }): void;
}

const RouterContext = createContext<RouterValue | null>(null);

export const PAGE_PATHS: Record<Page, string> = {
  landing: "/",
  board: "/board",
  insights: "/insights",
};

function readLocation(): Location {
  const { pathname, search } = window.location;
  const path = pathname.replace(/\/+$/, "") || "/";
  const page: Page = path === "/insights" ? "insights" : path === "/board" ? "board" : "landing";
  const raw = new URLSearchParams(search).get("app");
  const appId = raw && /^\d+$/.test(raw) ? Number(raw) : null;
  return { page, appId };
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<Location>(readLocation);

  useEffect(() => {
    const onPop = () => setLocation(readLocation());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((path: string, options?: { replace?: boolean }) => {
    const target = new URL(path, window.location.origin);
    const current = window.location.pathname + window.location.search;
    if (target.pathname + target.search === current) return;
    window.history[options?.replace ? "replaceState" : "pushState"](null, "", target);
    setLocation(readLocation());
  }, []);

  const openApplication = useCallback(
    (id: number | null, options?: { replace?: boolean }) => {
      const params = new URLSearchParams(window.location.search);
      if (id === null) params.delete("app");
      else params.set("app", String(id));
      const query = params.toString();
      navigate(`${window.location.pathname}${query ? `?${query}` : ""}`, options);
    },
    [navigate],
  );

  const value = useMemo(
    () => ({ ...location, navigate, openApplication }),
    [location, navigate, openApplication],
  );
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterValue {
  const value = useContext(RouterContext);
  if (!value) throw new Error("useRouter must be used inside RouterProvider");
  return value;
}

interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
}

export function Link({ to, onClick, ...rest }: LinkProps) {
  const { navigate } = useRouter();
  const handle = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(to);
  };
  return <a href={to} onClick={handle} {...rest} />;
}
