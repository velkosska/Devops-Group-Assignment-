import { normalizeUrl } from "./company";
import { todayIso } from "./dates";
import type { Stage } from "./stages";
import type { Application, ApplicationInput } from "./types";

export interface ApplicationFormValues {
  company: string;
  role: string;
  url: string;
  location: string;
  salary_range: string;
  applied_at: string;
  stage: Stage;
}

export type FieldErrors = Partial<Record<keyof ApplicationFormValues, string>>;

export function validateForm(values: ApplicationFormValues): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.company.trim()) errors.company = "Add the company name.";
  if (!values.role.trim()) errors.role = "Add the role you applied for.";
  if (values.company.trim().length > 200) errors.company = "Keep it under 200 characters.";
  if (values.role.trim().length > 200) errors.role = "Keep it under 200 characters.";

  if (values.url.trim()) {
    try {
      const parsed = new URL(normalizeUrl(values.url));
      if (!parsed.hostname.includes(".")) throw new Error("no host");
    } catch {
      errors.url = "That doesn't look like a link. Try something like company.com/jobs/123.";
    }
  }

  if (values.applied_at) {
    const applied = new Date(`${values.applied_at}T00:00:00`);
    if (Number.isNaN(applied.getTime())) errors.applied_at = "Pick a valid date.";
    else if (applied.getTime() > Date.now()) errors.applied_at = "That date is in the future.";
  }
  return errors;
}

function optional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function toInput(values: ApplicationFormValues, includeStage: boolean): ApplicationInput {
  const input: ApplicationInput = {
    company: values.company.trim(),
    role: values.role.trim(),
    url: values.url.trim() ? normalizeUrl(values.url) : null,
    location: optional(values.location),
    salary_range: optional(values.salary_range),
    applied_at: optional(values.applied_at),
  };
  if (includeStage) input.stage = values.stage;
  return input;
}

export function emptyValues(stage: Stage = "applied"): ApplicationFormValues {
  return {
    company: "",
    role: "",
    url: "",
    location: "",
    salary_range: "",
    applied_at: todayIso(),
    stage,
  };
}

export function valuesFrom(app: Application): ApplicationFormValues {
  return {
    company: app.company,
    role: app.role,
    url: app.url ?? "",
    location: app.location ?? "",
    salary_range: app.salary_range ?? "",
    applied_at: app.applied_at?.slice(0, 10) ?? "",
    stage: app.stage,
  };
}
