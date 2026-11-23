import { createContext, useContext } from "react";
import type { Stage } from "../../lib/stages";

export interface DragState {
  id: number;
  from: Stage;
}

export const DragContext = createContext<{
  drag: DragState | null;
  setDrag: (drag: DragState | null) => void;
}>({ drag: null, setDrag: () => undefined });

export const useDrag = () => useContext(DragContext);
