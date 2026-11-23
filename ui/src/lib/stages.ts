export const STAGES = ["applied", "screen", "interview", "offer", "rejected"] as const;
export type Stage = (typeof STAGES)[number];

export const PATH_STAGES: readonly Stage[] = ["applied", "screen", "interview", "offer"];

export const FINAL_STAGES: ReadonlySet<Stage> = new Set<Stage>(["offer", "rejected"]);

interface StageMeta {
  label: string;
  hint: string;
  empty: string;
}

export const STAGE_META: Record<Stage, StageMeta> = {
  applied: {
    label: "Applied",
    hint: "Sent and waiting",
    empty: "Applications you send land here",
  },
  screen: {
    label: "Phone screen",
    hint: "First conversations",
    empty: "Drag a card here when a recruiter reaches out",
  },
  interview: {
    label: "Interview",
    hint: "In the loop",
    empty: "Interviews in progress show up here",
  },
  offer: {
    label: "Offer",
    hint: "Offers received",
    empty: "Offers you receive land here",
  },
  rejected: {
    label: "Rejected",
    hint: "Closed for now",
    empty: "Closed applications land here",
  },
};

export function isStage(value: unknown): value is Stage {
  return typeof value === "string" && (STAGES as readonly string[]).includes(value);
}

export function isFinal(stage: Stage): boolean {
  return FINAL_STAGES.has(stage);
}

export function adjacentStage(stage: Stage, direction: -1 | 1): Stage | null {
  if (stage === "rejected") return null;
  const index = PATH_STAGES.indexOf(stage);
  return PATH_STAGES[index + direction] ?? null;
}
