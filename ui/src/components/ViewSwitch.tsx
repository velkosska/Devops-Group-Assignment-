import { Link, useRouter } from "../state/router";
import { Icon, type IconName } from "./Icon";

const VIEWS: Array<{ id: "home" | "app"; to: string; label: string; icon: IconName }> = [
  { id: "home", to: "/", label: "Home", icon: "home" },
  { id: "app", to: "/board", label: "App", icon: "board" },
];

/** Segmented switch between the landing page and the app. */
export function ViewSwitch({ className = "" }: { className?: string }) {
  const { page } = useRouter();
  const active = page === "landing" ? "home" : "app";
  return (
    <nav className={`view-switch ${className}`.trim()} aria-label="Switch view">
      {VIEWS.map((view) => (
        <Link
          key={view.id}
          to={view.to}
          aria-current={active === view.id ? "page" : undefined}
          title={view.id === "home" ? "Landing page" : "Open the app"}
        >
          <Icon name={view.icon} size={15} />
          <span className="view-switch__label">{view.label}</span>
        </Link>
      ))}
    </nav>
  );
}
