export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="logo-mark">
      <rect width="32" height="32" rx="9" fill="var(--brand)" />
      <path
        d="M9 10h14M9 16h10M9 22h6"
        stroke="var(--brand-ink)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="23" cy="22" r="2.6" fill="var(--attention-dot)" />
    </svg>
  );
}

export const APP_NAME = "Shortlist";
