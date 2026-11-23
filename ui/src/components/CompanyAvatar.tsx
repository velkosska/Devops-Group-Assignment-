import { monogram } from "../lib/company";

export function CompanyAvatar({ company, size = 36 }: { company: string; size?: number }) {
  return (
    <span
      className="avatar"
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {monogram(company)}
    </span>
  );
}
