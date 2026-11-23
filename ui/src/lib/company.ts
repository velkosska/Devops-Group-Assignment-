export function monogram(company: string): string {
  const words = company
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function companyHue(company: string): number {
  let hash = 0;
  for (const char of company.trim().toLowerCase()) {
    hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  }
  return hash % 360;
}

const BOARD_HOSTS: Record<string, "path" | "subdomain"> = {
  "greenhouse.io": "path",
  "lever.co": "path",
  "ashbyhq.com": "path",
  "workable.com": "path",
  "smartrecruiters.com": "path",
  "myworkdayjobs.com": "subdomain",
  "bamboohr.com": "subdomain",
  "recruitee.com": "subdomain",
  "teamtailor.com": "subdomain",
};

const UNKNOWN_HOSTS = [
  "linkedin.com",
  "indeed.com",
  "glassdoor.com",
  "google.com",
  "wellfound.com",
];

const SKIP_SUBDOMAINS = new Set([
  "www",
  "jobs",
  "careers",
  "career",
  "apply",
  "boards",
  "job-boards",
  "en",
  "eu",
]);

function titleCase(slug: string): string {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function companyFromUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (!host.includes(".")) return null;
  if (UNKNOWN_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return null;

  for (const [board, mode] of Object.entries(BOARD_HOSTS)) {
    if (host === board || host.endsWith(`.${board}`)) {
      if (mode === "subdomain") {
        const sub = host.slice(0, -board.length - 1).split(".")[0];
        return sub && !SKIP_SUBDOMAINS.has(sub) ? titleCase(sub) : null;
      }
      const first = url.pathname.split("/").filter(Boolean)[0];
      return first ? titleCase(first) : null;
    }
  }

  const labels = host.split(".").filter((label) => !SKIP_SUBDOMAINS.has(label));
  const suffixParts = labels.length > 2 && labels.at(-2)!.length <= 3 ? 2 : 1;
  const name = labels.at(-(suffixParts + 1));
  return name ? titleCase(name) : null;
}

export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function displayHost(url: string): string {
  try {
    return new URL(normalizeUrl(url)).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
