import type { Stage } from "./stages";

export interface Application {
  id: number;
  company: string;
  role: string;
  url: string | null;
  stage: Stage;
  location: string | null;
  salary_range: string | null;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApplicationInput {
  company: string;
  role: string;
  url: string | null;
  location: string | null;
  salary_range: string | null;
  applied_at: string | null;
  stage?: Stage;
}

export interface StageEvent {
  application_id: number;
  from_stage: Stage | null;
  to_stage: Stage | null;
  occurred_at: string;
}
