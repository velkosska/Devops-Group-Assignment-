import { funnelFromEvents, staleFromEvents, timeInStageFromEvents } from "../lib/analytics";
import { todayIso } from "../lib/dates";
import { isStage, STAGES, type Stage } from "../lib/stages";
import type { Application, ApplicationInput, StageEvent } from "../lib/types";
import { ApiError } from "./http";
import type { ApplicationsApi, InsightsApi } from "./types";

const STORAGE_KEY = "shortlist.demo.v1";
const DAY_MS = 86_400_000;

interface DemoState {
  nextId: number;
  applications: Application[];
  events: StageEvent[];
}

type Seed = [string, string, string | null, string | null, string | null, Array<[Stage, number]>];

const SEEDS: Seed[] = [
  [
    "Northwind Systems",
    "Senior Frontend Engineer",
    "Remote · EU",
    "€70–85k",
    "jobs.lever.co/northwind/1182",
    [
      ["applied", 31],
      ["screen", 24],
      ["interview", 15],
      ["offer", 2],
    ],
  ],
  [
    "Lumen Labs",
    "Product Engineer",
    "Madrid",
    "€55–65k",
    "boards.greenhouse.io/lumenlabs/jobs/4471",
    [
      ["applied", 27],
      ["screen", 19],
      ["interview", 6],
    ],
  ],
  [
    "Fieldnote",
    "Full-stack Developer",
    "Barcelona",
    "€50–60k",
    "fieldnote.io/careers/fullstack",
    [
      ["applied", 22],
      ["screen", 12],
      ["interview", 3],
    ],
  ],
  [
    "Orbital Freight",
    "Platform Engineer",
    "Remote",
    "€65–75k",
    null,
    [
      ["applied", 25],
      ["screen", 9],
    ],
  ],
  [
    "Kettle & Co",
    "Junior Software Engineer",
    "Lisbon",
    "€38–45k",
    "kettle.co/jobs/junior-swe",
    [
      ["applied", 14],
      ["screen", 4],
    ],
  ],
  [
    "Paperplane",
    "DevOps Engineer",
    "Remote · EU",
    "€60–70k",
    "jobs.ashbyhq.com/paperplane/devops",
    [["applied", 19]],
  ],
  ["Brightside Health", "Frontend Engineer", "Berlin", "€62–72k", null, [["applied", 17]]],
  [
    "Tessera",
    "Software Engineer, Payments",
    "Dublin",
    "€70–80k",
    "tessera.dev/careers/payments",
    [["applied", 8]],
  ],
  ["Mosaic Analytics", "Data Engineer", "Madrid", null, null, [["applied", 5]]],
  ["Halcyon", "React Developer", "Remote", "€48–58k", "halcyon.app/jobs/react", [["applied", 2]]],
  [
    "Quarry",
    "Backend Engineer (Python)",
    "Amsterdam",
    "€65–78k",
    "jobs.lever.co/quarry/backend",
    [["applied", 1]],
  ],
  [
    "Verdant Energy",
    "Cloud Engineer",
    "Madrid",
    "€58–68k",
    null,
    [
      ["applied", 34],
      ["screen", 28],
      ["interview", 21],
      ["rejected", 12],
    ],
  ],
  [
    "Signal Harbor",
    "Site Reliability Engineer",
    "London",
    "£60–70k",
    null,
    [
      ["applied", 30],
      ["screen", 23],
      ["rejected", 16],
    ],
  ],
  [
    "Pinecrest",
    "Graduate Developer",
    "Remote",
    null,
    null,
    [
      ["applied", 26],
      ["rejected", 20],
    ],
  ],
];

function isoDaysAgo(days: number, now: Date, hour = 10): string {
  const d = new Date(now.getTime() - days * DAY_MS);
  d.setHours(hour, (days * 17) % 60, 0, 0);
  return d.toISOString();
}

export function seedState(now = new Date()): DemoState {
  const applications: Application[] = [];
  const events: StageEvent[] = [];
  SEEDS.forEach(([company, role, location, salary, url, path], index) => {
    const id = index + 1;
    const created = isoDaysAgo(path[0][1], now);
    const updated = isoDaysAgo(path.at(-1)![1], now, 15);
    applications.push({
      id,
      company,
      role,
      url: url ? `https://${url}` : null,
      stage: path.at(-1)![0],
      location,
      salary_range: salary,
      applied_at: created.slice(0, 10),
      created_at: created,
      updated_at: updated,
    });
    path.forEach(([stage, days], i) => {
      events.push({
        application_id: id,
        from_stage: i === 0 ? null : path[i - 1][0],
        to_stage: stage,
        occurred_at: i === 0 ? created : isoDaysAgo(days, now, 15),
      });
    });
  });
  return { nextId: SEEDS.length + 1, applications, events };
}

function load(): DemoState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoState;
      if (Array.isArray(parsed.applications) && Array.isArray(parsed.events)) return parsed;
    }
  } catch {
    return seedState();
  }
  return seedState();
}

function save(state: DemoState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    return;
  }
}

export function resetDemo(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    return;
  }
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function requireText(value: string, field: string): string {
  if (!value || !value.trim()) throw new ApiError("validation", `${field} is required`, 422);
  return value.trim();
}

export interface DemoOptions {
  latencyMs?: number;
}

export function createDemoBackend(options: DemoOptions = {}): {
  applications: ApplicationsApi;
  insights: InsightsApi;
} {
  const latency = options.latencyMs ?? 260;
  let state = load();

  const wait = <T>(value: () => T): Promise<T> =>
    new Promise((resolve, reject) => {
      setTimeout(
        () => {
          try {
            resolve(value());
          } catch (error) {
            reject(error);
          }
        },
        latency ? latency * (0.6 + Math.random() * 0.8) : 0,
      );
    });

  const find = (id: number) => {
    const app = state.applications.find((a) => a.id === id);
    if (!app) throw new ApiError("not_found", "That application no longer exists.", 404);
    return app;
  };

  const commit = (next: DemoState) => {
    state = next;
    save(state);
  };

  const applications: ApplicationsApi = {
    list: () => wait(() => structuredClone(state.applications)),

    create: (input: ApplicationInput) =>
      wait(() => {
        const now = new Date().toISOString();
        const stage = input.stage ?? "applied";
        if (!isStage(stage))
          throw new ApiError("validation", `stage must be one of: ${STAGES.join(", ")}`, 422);
        const app: Application = {
          id: state.nextId,
          company: requireText(input.company, "company"),
          role: requireText(input.role, "role"),
          url: clean(input.url),
          stage,
          location: clean(input.location),
          salary_range: clean(input.salary_range),
          applied_at: clean(input.applied_at) ?? todayIso(),
          created_at: now,
          updated_at: now,
        };
        commit({
          nextId: state.nextId + 1,
          applications: [...state.applications, app],
          events: [
            ...state.events,
            { application_id: app.id, from_stage: null, to_stage: stage, occurred_at: now },
          ],
        });
        return structuredClone(app);
      }),

    update: (id, input) =>
      wait(() => {
        const current = find(id);
        const updated: Application = {
          ...current,
          company: requireText(input.company, "company"),
          role: requireText(input.role, "role"),
          url: clean(input.url),
          location: clean(input.location),
          salary_range: clean(input.salary_range),
          applied_at: clean(input.applied_at),
          updated_at: new Date().toISOString(),
        };
        commit({
          ...state,
          applications: state.applications.map((a) => (a.id === id ? updated : a)),
        });
        return structuredClone(updated);
      }),

    moveStage: (id, stage) =>
      wait(() => {
        const current = find(id);
        if (!isStage(stage))
          throw new ApiError("validation", `stage must be one of: ${STAGES.join(", ")}`, 422);
        if (current.stage === stage)
          throw new ApiError("validation", "stage must change to a different stage", 422);
        const now = new Date().toISOString();
        const updated = { ...current, stage, updated_at: now };
        commit({
          ...state,
          applications: state.applications.map((a) => (a.id === id ? updated : a)),
          events: [
            ...state.events,
            { application_id: id, from_stage: current.stage, to_stage: stage, occurred_at: now },
          ],
        });
        return structuredClone(updated);
      }),

    remove: (id) =>
      wait(() => {
        const current = find(id);
        commit({
          ...state,
          applications: state.applications.filter((a) => a.id !== id),
          events: [
            ...state.events,
            {
              application_id: id,
              from_stage: current.stage,
              to_stage: null,
              occurred_at: new Date().toISOString(),
            },
          ],
        });
      }),
  };

  const insights: InsightsApi = {
    funnel: () => wait(() => funnelFromEvents(state.events)),
    timeInStage: () => wait(() => timeInStageFromEvents(state.events)),
    stale: (days) => wait(() => staleFromEvents(state.events, days)),
    timeline: (applicationId) =>
      wait(() =>
        state.events
          .filter((e) => e.application_id === applicationId)
          .sort((a, b) => Date.parse(a.occurred_at) - Date.parse(b.occurred_at)),
      ),
  };

  return { applications, insights };
}
