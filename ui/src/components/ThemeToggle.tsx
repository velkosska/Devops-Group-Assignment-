import { THEMES, type ThemeChoice } from "../state/theme";
import { Icon } from "./Icon";

const NEXT: Record<ThemeChoice, ThemeChoice> = { light: "dark", dark: "system", system: "light" };

/** One button that cycles light → dark → system, showing the current choice. */
export function ThemeToggle({
  theme,
  onTheme,
  className = "",
}: {
  theme: ThemeChoice;
  onTheme: (theme: ThemeChoice) => void;
  className?: string;
}) {
  const current = THEMES.find((t) => t.value === theme)!;
  return (
    <button
      type="button"
      className={`icon-btn icon-btn--lg ${className}`.trim()}
      aria-label={`${current.label}. Change theme`}
      title={current.label}
      onClick={() => onTheme(NEXT[theme])}
    >
      <Icon name={current.icon} size={18} />
    </button>
  );
}
