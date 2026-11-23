import type { ReactNode } from "react";
import { Icon, type IconName } from "../../components/Icon";
import { Kbd } from "../../components/Kbd";
import { MOD } from "../../lib/platform";
import { APP_NAME, Logo } from "../../components/Logo";
import { quietDays } from "../../lib/follow-up";
import { useApplications } from "../../state/applications";
import { useBackend } from "../../state/backend";
import { Link, PAGE_PATHS, useRouter, type Page } from "../../state/router";
import { THEMES, type ThemeChoice } from "../../state/theme";
import { ThemeToggle } from "../../components/ThemeToggle";
import { ViewSwitch } from "../../components/ViewSwitch";

interface ShellProps {
  children: ReactNode;
  theme: ThemeChoice;
  onTheme: (theme: ThemeChoice) => void;
  onOpenPalette: () => void;
  onResetDemo: () => void;
}

const NAV: Array<{ page: Page; label: string; icon: IconName }> = [
  { page: "board", label: "Board", icon: "board" },
  { page: "insights", label: "Insights", icon: "chart" },
];

export function AppShell({ children, theme, onTheme, onOpenPalette, onResetDemo }: ShellProps) {
  const { page } = useRouter();
  const { applications, status } = useApplications();
  const { demo } = useBackend();
  const quiet = applications.filter((a) => quietDays(a) !== null).length;

  const navLinks = (variant: "side" | "top") =>
    NAV.map((item) => (
      <Link
        key={item.page}
        to={PAGE_PATHS[item.page]}
        className={`nav-link nav-link--${variant}`}
        aria-current={page === item.page ? "page" : undefined}
      >
        <Icon name={item.icon} size={18} />
        <span>{item.label}</span>
        {variant === "side" && item.page === "board" && status === "ready" && (
          <span className="nav-link__count num">{applications.length}</span>
        )}
        {variant === "side" && item.page === "insights" && quiet > 0 && (
          <span className="nav-link__badge num" title={`${quiet} gone quiet`}>
            {quiet}
            <span className="visually-hidden"> gone quiet</span>
          </span>
        )}
      </Link>
    ));

  return (
    <div className="shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <aside className="sidebar" aria-label="Main">
        <Link to="/board" className="brand" aria-label={`${APP_NAME}, go to board`}>
          <Logo />
          <span className="brand__name">{APP_NAME}</span>
        </Link>

        <button type="button" className="search-trigger" onClick={onOpenPalette}>
          <Icon name="search" size={16} />
          <span className="search-trigger__label">Search</span>
          <span className="search-trigger__keys" aria-hidden="true">
            <Kbd>{MOD}</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>

        <nav className="sidebar__nav" aria-label="Pages">
          {navLinks("side")}
        </nav>

        <div className="sidebar__footer">
          <ViewSwitch />
          {demo && (
            <div className="demo-note">
              <p className="demo-note__title">
                <Icon name="database" size={14} /> Demo data
              </p>
              <p>Saved in this browser only. Set the API URLs to use the real services.</p>
              <button type="button" className="text-link text-link--muted" onClick={onResetDemo}>
                Reset demo
              </button>
            </div>
          )}
          <div className="theme-switch" role="radiogroup" aria-label="Theme">
            {THEMES.map((t) => (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={theme === t.value}
                aria-label={t.label}
                title={t.label}
                onClick={() => onTheme(t.value)}
              >
                <Icon name={t.icon} size={15} />
              </button>
            ))}
          </div>
        </div>
      </aside>

      <header className="topbar">
        <Link to="/board" className="brand" aria-label={`${APP_NAME}, go to board`}>
          <Logo size={26} />
          <span className="brand__name">{APP_NAME}</span>
        </Link>
        <nav className="topbar__nav" aria-label="Pages">
          {navLinks("top")}
        </nav>
        <div className="topbar__tools">
          <ViewSwitch className="topbar__view" />
          <button
            type="button"
            className="icon-btn icon-btn--lg"
            onClick={onOpenPalette}
            aria-label="Search"
          >
            <Icon name="search" size={18} />
          </button>
          <ThemeToggle theme={theme} onTheme={onTheme} />
        </div>
      </header>

      <main id="main" className="main" tabIndex={-1}>
        {demo && (
          <p className="demo-ribbon">
            <Icon name="database" size={13} /> Demo data, saved in this browser.
            <button type="button" className="text-link" onClick={onResetDemo}>
              Reset
            </button>
          </p>
        )}
        {children}
      </main>
    </div>
  );
}
