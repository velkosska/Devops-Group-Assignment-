import type { Funnel, StageDuration, StaleItem } from "../lib/analytics";
import type { Stage } from "../lib/stages";
import type { Application, ApplicationInput, StageEvent } from "../lib/types";

export interface ApplicationsApi {
  list(signal?: AbortSignal): Promise<Application[]>;
  create(input: ApplicationInput): Promise<Application>;
  update(id: number, input: ApplicationInput): Promise<Application>;
  moveStage(id: number, stage: Stage): Promise<Application>;
  remove(id: number): Promise<void>;
}

export interface InsightsApi {
  funnel(signal?: AbortSignal): Promise<Funnel>;
  timeInStage(signal?: AbortSignal): Promise<StageDuration[]>;
  stale(days: number, signal?: AbortSignal): Promise<StaleItem[]>;
  timeline(applicationId: number, signal?: AbortSignal): Promise<StageEvent[] | null>;
}
