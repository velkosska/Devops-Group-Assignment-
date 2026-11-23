const DAY_MS = 86_400_000;

export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const plain = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = plain ? new Date(`${value}T00:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function daysBetween(from: Date, to: Date = new Date()): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY_MS));
}

export function daysSince(value: string | null | undefined, now: Date = new Date()): number | null {
  const date = parseDate(value);
  return date ? daysBetween(date, now) : null;
}

export function shortAgo(value: string | null | undefined, now: Date = new Date()): string {
  const days = daysSince(value, now);
  if (days === null) return "—";
  if (days === 0) return "Today";
  if (days < 14) return `${days}d`;
  if (days < 60) return `${Math.floor(days / 7)}w`;
  return `${Math.floor(days / 30)}mo`;
}

export function longAgo(value: string | null | undefined, now: Date = new Date()): string {
  const days = daysSince(value, now);
  if (days === null) return "unknown";
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 60) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

const dateFormat = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatDate(value: string | null | undefined): string {
  const date = parseDate(value);
  return date ? dateFormat.format(date) : "—";
}

export function todayIso(now: Date = new Date()): string {
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}
