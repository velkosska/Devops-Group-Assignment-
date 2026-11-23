import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { ApiError } from "../api";
import { STAGE_META, type Stage } from "../lib/stages";
import type { Application, ApplicationInput } from "../lib/types";
import { useBackend } from "./backend";
import { useRouter } from "./router";
import { useToasts } from "./toasts";

export type LoadStatus = "loading" | "ready" | "error";

interface State {
  status: LoadStatus;
  applications: Application[];
  error: string | null;
  slow: boolean;
  outage: boolean;
  pending: ReadonlySet<number>;
  recentId: number | null;
}

type Action =
  | { type: "load:start" }
  | { type: "load:slow" }
  | { type: "load:done"; applications: Application[] }
  | { type: "load:fail"; error: string }
  | { type: "outage"; value: boolean }
  | { type: "pending"; id: number; value: boolean }
  | { type: "upsert"; application: Application; recent?: boolean }
  | { type: "remove"; id: number }
  | { type: "restore"; application: Application };

const initial: State = {
  status: "loading",
  applications: [],
  error: null,
  slow: false,
  outage: false,
  pending: new Set(),
  recentId: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "load:start":
      return {
        ...state,
        status: state.status === "ready" ? "ready" : "loading",
        slow: false,
        error: null,
      };
    case "load:slow":
      return state.status === "loading" ? { ...state, slow: true } : state;
    case "load:done":
      return {
        ...state,
        status: "ready",
        applications: action.applications,
        slow: false,
        outage: false,
      };
    case "load:fail":
      return {
        ...state,
        status: state.status === "ready" ? "ready" : "error",
        error: action.error,
        slow: false,
        outage: true,
      };
    case "outage":
      return state.outage === action.value ? state : { ...state, outage: action.value };
    case "pending": {
      const pending = new Set(state.pending);
      if (action.value) pending.add(action.id);
      else pending.delete(action.id);
      return { ...state, pending };
    }
    case "upsert": {
      const exists = state.applications.some((a) => a.id === action.application.id);
      return {
        ...state,
        applications: exists
          ? state.applications.map((a) => (a.id === action.application.id ? action.application : a))
          : [...state.applications, action.application],
        recentId: action.recent ? action.application.id : state.recentId,
      };
    }
    case "remove":
      return { ...state, applications: state.applications.filter((a) => a.id !== action.id) };
    case "restore":
      return state.applications.some((a) => a.id === action.application.id)
        ? state
        : { ...state, applications: [...state.applications, action.application] };
  }
}

interface ApplicationsValue extends State {
  reload(): void;
  create(input: ApplicationInput): Promise<Application>;
  update(id: number, input: ApplicationInput): Promise<Application>;
  move(id: number, stage: Stage): Promise<void>;
  remove(id: number): Promise<void>;
  get(id: number): Application | undefined;
}

const ApplicationsContext = createContext<ApplicationsValue | null>(null);

function friendly(error: unknown): string {
  return error instanceof ApiError ? error.message : "Something unexpected went wrong.";
}

function isOutage(error: unknown): boolean {
  return error instanceof ApiError && (error.kind === "timeout" || error.kind === "unavailable");
}

export function ApplicationsProvider({ children }: { children: ReactNode }) {
  const { applications: api } = useBackend();
  const { show } = useToasts();
  const { openApplication } = useRouter();
  const [state, dispatch] = useReducer(reducer, initial);
  const stateRef = useRef(state);
  stateRef.current = state;

  const reload = useCallback(() => {
    const controller = new AbortController();
    dispatch({ type: "load:start" });
    const slowTimer = setTimeout(() => dispatch({ type: "load:slow" }), 2500);
    api
      .list(controller.signal)
      .then((applications) => dispatch({ type: "load:done", applications }))
      .catch((error) => {
        if (!controller.signal.aborted) dispatch({ type: "load:fail", error: friendly(error) });
      })
      .finally(() => clearTimeout(slowTimer));
    return () => {
      clearTimeout(slowTimer);
      controller.abort();
    };
  }, [api]);

  useEffect(() => reload(), [reload]);

  const track = useCallback(async <T,>(id: number | null, run: () => Promise<T>): Promise<T> => {
    if (id !== null) dispatch({ type: "pending", id, value: true });
    try {
      const result = await run();
      dispatch({ type: "outage", value: false });
      return result;
    } catch (error) {
      if (isOutage(error)) dispatch({ type: "outage", value: true });
      throw error;
    } finally {
      if (id !== null) dispatch({ type: "pending", id, value: false });
    }
  }, []);

  const create = useCallback(
    async (input: ApplicationInput) => {
      const created = await track(null, () => api.create(input));
      dispatch({ type: "upsert", application: created, recent: true });
      show({
        tone: "success",
        message: `Added ${created.role} at ${created.company}`,
        action: { label: "Open", run: () => openApplication(created.id) },
      });
      return created;
    },
    [api, openApplication, show, track],
  );

  const update = useCallback(
    async (id: number, input: ApplicationInput) => {
      const saved = await track(id, () => api.update(id, input));
      dispatch({ type: "upsert", application: saved });
      show({ tone: "success", message: "Changes saved" });
      return saved;
    },
    [api, show, track],
  );

  const moveInternal = useCallback(
    async (id: number, stage: Stage, allowUndo: boolean): Promise<void> => {
      const before = stateRef.current.applications.find((a) => a.id === id);
      if (!before || before.stage === stage) return;
      dispatch({
        type: "upsert",
        application: { ...before, stage, updated_at: new Date().toISOString() },
      });
      try {
        const saved = await track(id, () => api.moveStage(id, stage));
        dispatch({ type: "upsert", application: saved });
        show({
          message: `${before.company} moved to ${STAGE_META[stage].label}`,
          tone: stage === "offer" ? "success" : "neutral",
          action: allowUndo
            ? {
                label: "Undo",
                run: () => void moveInternal(id, before.stage, false).catch(() => undefined),
              }
            : undefined,
        });
      } catch (error) {
        dispatch({ type: "upsert", application: before });
        show({ tone: "error", message: `Couldn't move ${before.company}. ${friendly(error)}` });
        throw error;
      }
    },
    [api, show, track],
  );

  const move = useCallback(
    (id: number, stage: Stage) => moveInternal(id, stage, true),
    [moveInternal],
  );

  const remove = useCallback(
    async (id: number) => {
      const before = stateRef.current.applications.find((a) => a.id === id);
      if (!before) return;
      dispatch({ type: "remove", id });
      try {
        await track(id, () => api.remove(id));
        show({ message: `Deleted ${before.role} at ${before.company}` });
      } catch (error) {
        if (error instanceof ApiError && error.kind === "not_found") return;
        dispatch({ type: "restore", application: before });
        show({ tone: "error", message: `Couldn't delete it. ${friendly(error)}` });
        throw error;
      }
    },
    [api, show, track],
  );

  const get = useCallback(
    (id: number) => state.applications.find((a) => a.id === id),
    [state.applications],
  );

  const value = useMemo(
    () => ({ ...state, reload, create, update, move, remove, get }),
    [state, reload, create, update, move, remove, get],
  );
  return <ApplicationsContext.Provider value={value}>{children}</ApplicationsContext.Provider>;
}

export function useApplications(): ApplicationsValue {
  const value = useContext(ApplicationsContext);
  if (!value) throw new Error("useApplications must be used inside ApplicationsProvider");
  return value;
}
