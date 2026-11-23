import { daysSince } from "./dates";
import { isFinal } from "./stages";
import type { Application } from "./types";

export const FOLLOW_UP_DAYS = 14;

export function quietDays(
  app: Application,
  now = new Date(),
  threshold = FOLLOW_UP_DAYS,
): number | null {
  if (isFinal(app.stage)) return null;
  const days = daysSince(app.updated_at, now);
  return days !== null && days > threshold ? days : null;
}

export function matchesQuery(app: Application, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [app.company, app.role, app.location ?? "", app.salary_range ?? ""].some((v) =>
    v.toLowerCase().includes(q),
  );
}
