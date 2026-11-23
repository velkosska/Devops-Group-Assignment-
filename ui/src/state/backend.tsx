import { createContext, useContext, type ReactNode } from "react";
import type { Backend } from "../api";

const BackendContext = createContext<Backend | null>(null);

export function BackendProvider({ backend, children }: { backend: Backend; children: ReactNode }) {
  return <BackendContext.Provider value={backend}>{children}</BackendContext.Provider>;
}

export function useBackend(): Backend {
  const value = useContext(BackendContext);
  if (!value) throw new Error("useBackend must be used inside BackendProvider");
  return value;
}
