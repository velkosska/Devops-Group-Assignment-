import { companyHue, monogram } from "../lib/company";

export function CompanyAvatar({ company, size = 36 }: { company: string; size?: number }) {
  const hue = companyHue(company);
  return (
    <span
      className="avatar"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.38),
        ["--avatar-hue" as string]: hue,
      }}
    >
      {monogram(company)}
    </span>
  );
}
