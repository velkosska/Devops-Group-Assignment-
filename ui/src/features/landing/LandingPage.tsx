import { useEffect, useState, type CSSProperties } from "react";
import { CompanyAvatar } from "../../components/CompanyAvatar";
import { Icon } from "../../components/Icon";
import { Kbd } from "../../components/Kbd";
import { APP_NAME, Logo } from "../../components/Logo";
import { StageDot } from "../../components/StageBadge";
import { STAGE_META, type Stage } from "../../lib/stages";
import { ThemeToggle } from "../../components/ThemeToggle";
import { ViewSwitch } from "../../components/ViewSwitch";
import { Link } from "../../state/router";
import type { ThemeChoice } from "../../state/theme";

interface MiniApp {
  role: string;
  company: string;
  meta: string;
  age: string;
  quiet?: number;
}

const BOARD: Array<{ stage: Stage; apps: MiniApp[] }> = [
  {
    stage: "applied",
    apps: [
      {
        role: "Backend Engineer (Python)",
        company: "Quarry",
        meta: "Amsterdam · €65–78k",
        age: "Today",
      },
      { role: "React Developer", company: "Halcyon", meta: "Remote · €48–58k", age: "1d" },
      {
        role: "DevOps Engineer",
        company: "Paperplane",
        meta: "Remote · EU · €60–70k",
        age: "19d",
        quiet: 19,
      },
    ],
  },
  {
    stage: "screen",
    apps: [
      {
        role: "Junior Software Engineer",
        company: "Kettle & Co",
        meta: "Lisbon · €38–45k",
        age: "3d",
      },
    ],
  },
  {
    stage: "interview",
    apps: [
      {
        role: "Full-stack Developer",
        company: "Fieldnote",
        meta: "Barcelona · €50–60k",
        age: "2d",
      },
    ],
  },
  {
    stage: "offer",
    apps: [
      {
        role: "Senior Frontend Engineer",
        company: "Northwind Systems",
        meta: "Remote · EU · €70–85k",
        age: "1d",
      },
    ],
  },
];

const LIFTED: MiniApp = {
  role: "Product Engineer",
  company: "Lumen Labs",
  meta: "Madrid · €55–65k",
  age: "5d",
};

function MiniCard({
  app,
  className,
  style,
}: {
  app: MiniApp;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={`mini-card ${className ?? ""}`} style={style}>
      <div className="mini-card__head">
        <CompanyAvatar company={app.company} size={28} />
        <div className="mini-card__titles">
          <p className="mini-card__role">{app.role}</p>
          <p className="mini-card__company">{app.company}</p>
        </div>
      </div>
      <p className="mini-card__meta">{app.meta}</p>
      {app.quiet ? (
        <span className="chip chip--attention">
          <span className="chip__dot" /> Quiet {app.quiet}d
        </span>
      ) : (
        <span className="mini-card__age num">{app.age}</span>
      )}
    </div>
  );
}

function BoardPreview() {
  return (
    <div className="app-window" aria-hidden="true">
      <div className="app-window__bar">
        <span className="app-window__dots">
          <span />
          <span />
          <span />
        </span>
        <span className="app-window__url">shortlist / board</span>
      </div>
      <div className="app-window__body">
        <div className="preview-head">
          <p className="preview-title">Pipeline</p>
          <p className="preview-sub num">
            7 applications · 6 in progress · <span className="preview-quiet">1 gone quiet</span>
          </p>
        </div>
        <div className="preview-board">
          {BOARD.map(({ stage, apps }) => (
            <div key={stage} className={`preview-col preview-col--${stage}`}>
              <div className="preview-col__head">
                <StageDot stage={stage} />
                <span>{STAGE_META[stage].label}</span>
                <span className="preview-col__count num">
                  {apps.length + (stage === "screen" ? 1 : 0)}
                </span>
              </div>
              <div className="preview-col__list">
                {apps.map((app) => (
                  <MiniCard key={app.company} app={app} />
                ))}
                {stage === "screen" && <div className="preview-slot preview-slot--origin" />}
                {stage === "interview" && (
                  <div className="preview-slot preview-slot--target">
                    <MiniCard app={LIFTED} className="mini-card--lifted" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function QuietPreview() {
  const rows = [
    { role: "DevOps Engineer", company: "Paperplane", stage: "applied" as Stage, days: 19 },
    {
      role: "Frontend Engineer",
      company: "Brightside Health",
      stage: "applied" as Stage,
      days: 17,
    },
    { role: "Platform Engineer", company: "Orbital Freight", stage: "screen" as Stage, days: 15 },
  ];
  return (
    <div className="preview-panel" aria-hidden="true">
      <div className="preview-panel__head">
        <p className="preview-panel__title">Gone quiet</p>
        <span className="preview-seg">
          <span>7d</span>
          <span className="is-on">14d</span>
          <span>30d</span>
        </span>
      </div>
      <ul className="quiet-rows">
        {rows.map((row) => (
          <li key={row.company}>
            <CompanyAvatar company={row.company} size={30} />
            <span className="quiet-rows__titles">
              <span className="quiet-rows__role">{row.role}</span>
              <span className="quiet-rows__company">{row.company}</span>
            </span>
            <span className="quiet-rows__stage">
              <StageDot stage={row.stage} size={6} />
              {STAGE_META[row.stage].label}
            </span>
            <span className="quiet-rows__days num">
              <strong>{row.days}</strong> days
            </span>
          </li>
        ))}
      </ul>
      <div className="preview-nudge">
        <Icon name="bell" size={16} />
        <p>
          <strong>No movement for 19 days</strong>
          <span>A short, friendly follow-up to the recruiter often gets things moving again</span>
        </p>
      </div>
    </div>
  );
}

function FunnelPreview() {
  const steps: Array<{ stage: Stage; count: number }> = [
    { stage: "applied", count: 14 },
    { stage: "screen", count: 7 },
    { stage: "interview", count: 4 },
    { stage: "offer", count: 1 },
  ];
  return (
    <div className="preview-panel" aria-hidden="true">
      <div className="preview-panel__head">
        <p className="preview-panel__title">Funnel</p>
        <span className="preview-panel__meta">How far each application got</span>
      </div>
      <ol className="preview-funnel">
        {steps.map((step, i) => (
          <li key={step.stage}>
            {i > 0 && (
              <span className="preview-funnel__conv num">
                ↳ {Math.round((step.count / steps[i - 1].count) * 100)}% moved on
              </span>
            )}
            <span className="preview-funnel__label">
              <StageDot stage={step.stage} />
              {STAGE_META[step.stage].label}
            </span>
            <span className="preview-funnel__track">
              <span
                className="preview-funnel__bar"
                style={{ width: `${(step.count / 14) * 100}%`, ["--i" as string]: i }}
              />
            </span>
            <span className="preview-funnel__value num">
              <strong>{step.count}</strong> {Math.round((step.count / 14) * 100)}%
            </span>
          </li>
        ))}
      </ol>
      <p className="preview-lead">
        Your biggest drop-off is Interview → Offer: 25% move on. Interview is the slowest stage, at
        a median of 11 days.
      </p>
    </div>
  );
}

const NAV_LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#follow-ups", label: "Follow-ups" },
  { href: "#insights", label: "Insights" },
];

interface LandingProps {
  theme: ThemeChoice;
  onTheme: (theme: ThemeChoice) => void;
}

export function LandingPage({ theme, onTheme }: LandingProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <div className="landing">
      <a href="#landing-main" className="skip-link">
        Skip to content
      </a>

      <header className="l-nav">
        <div className="l-wrap l-nav__inner">
          <a href="/" className="brand" aria-label={`${APP_NAME} home`}>
            <Logo size={26} />
            <span className="brand__name">{APP_NAME}</span>
          </a>
          <nav className="l-nav__links" aria-label="Sections">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>
          <div className="l-nav__tools">
            <ViewSwitch />
            <ThemeToggle theme={theme} onTheme={onTheme} />
          </div>
          <Link to="/board" className="btn btn--primary btn--sm l-nav__cta">
            <span className="btn__label">Open your board</span>
          </Link>
          <button
            type="button"
            className="icon-btn icon-btn--lg l-nav__menu"
            aria-expanded={menuOpen}
            aria-controls="landing-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <Icon name={menuOpen ? "x" : "more"} size={20} />
          </button>
        </div>
        {menuOpen && (
          <nav id="landing-menu" className="l-menu" aria-label="Sections">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>
                {link.label}
              </a>
            ))}
            <Link to="/board" className="btn btn--primary btn--lg">
              <span className="btn__label">Open your board</span>
            </Link>
          </nav>
        )}
      </header>

      <main id="landing-main">
        <section className="l-hero" aria-labelledby="hero-title">
          <div className="l-wrap l-hero__text">
            <h1 id="hero-title" className="l-hero__title display">
              Know where every job application stands
            </h1>
            <p className="l-hero__sub">
              One board for every role you apply to, from Applied to Offer. {APP_NAME} shows where
              your search stalls and which companies have gone quiet.
            </p>
            <div className="l-hero__actions">
              <Link to="/board" className="btn btn--primary btn--lg">
                <span className="btn__label">Open your board</span>
                <Icon name="arrowRight" size={18} />
              </Link>
              <a href="#how" className="btn btn--secondary btn--lg">
                <span className="btn__label">How it works</span>
              </a>
            </div>
          </div>
          <div className="l-wrap l-hero__visual">
            <BoardPreview />
          </div>
        </section>

        <section id="how" className="l-section" aria-labelledby="how-title">
          <div className="l-wrap">
            <div className="l-section__intro">
              <h2 id="how-title" className="l-section__title display">
                One card per application
              </h2>
              <p className="l-section__text">
                Every job you apply for becomes a card on a board with five stages: Applied, Phone
                screen, Interview, Offer and Rejected. Moving a card is how you log what happened.
              </p>
            </div>
            <ol className="l-steps">
              <li>
                <span className="l-steps__num num">1</span>
                <h3>Paste the job link</h3>
                <p>
                  The company is read from links on Lever, Greenhouse, Ashby and most careers pages,
                  so adding a job takes a company and a role
                </p>
              </li>
              <li>
                <span className="l-steps__num num">2</span>
                <h3>Move it as you hear back</h3>
                <p>
                  Drag the card, use its arrows, or press <Kbd>⌘</Kbd>
                  <Kbd>K</Kbd> to jump to it. Every move can be undone
                </p>
              </li>
              <li>
                <span className="l-steps__num num">3</span>
                <h3>Read the pattern</h3>
                <p>The funnel and reply times fill in from your own moves, with no spreadsheet</p>
              </li>
            </ol>
          </div>
        </section>

        <section
          id="follow-ups"
          className="l-section l-section--split"
          aria-labelledby="quiet-title"
        >
          <div className="l-wrap l-split">
            <div className="l-split__text">
              <h2 id="quiet-title" className="l-section__title display">
                Know who to follow up with
              </h2>
              <p className="l-section__text">
                An open application with no movement for 14 days gets an amber dot. The board can
                filter to just those, and the insights page lists them with how long each has been
                waiting, so a polite follow-up never slips.
              </p>
              <p className="l-signature">
                <span className="chip chip--attention">
                  <span className="chip__dot" /> Quiet 19d
                </span>
                <span>means it's time to write</span>
              </p>
            </div>
            <QuietPreview />
          </div>
        </section>

        <section
          id="insights"
          className="l-section l-section--split"
          aria-labelledby="insights-title"
        >
          <div className="l-wrap l-split l-split--reverse">
            <div className="l-split__text">
              <h2 id="insights-title" className="l-section__title display">
                See where your search stalls
              </h2>
              <p className="l-section__text">
                The funnel shows how far each application got and where most of them stop. Reply
                times show which stage companies sit on longest. Both come from the moves you
                already make on the board.
              </p>
            </div>
            <FunnelPreview />
          </div>
        </section>

        <section className="l-section" aria-labelledby="reliable-title">
          <div className="l-wrap l-reliable">
            <h2 id="reliable-title" className="l-section__title display">
              The board never waits on the numbers
            </h2>
            <div className="l-reliable__grid">
              <div>
                <h3>Your board</h3>
                <p>
                  Applications live in their own service with their own database. Adding, editing
                  and moving cards keeps working even when the analytics are down.
                </p>
              </div>
              <div>
                <h3>Your insights</h3>
                <p>
                  Analytics run separately and catch up from each stage change. If they're
                  unavailable, the dashboard says so plainly instead of spinning.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="l-cta" aria-labelledby="cta-title">
          <div className="l-wrap l-cta__inner">
            <h2 id="cta-title" className="l-cta__title display">
              Start with the job you applied to today
            </h2>
            <Link to="/board" className="btn btn--primary btn--lg">
              <span className="btn__label">Open your board</span>
              <Icon name="arrowRight" size={18} />
            </Link>
          </div>
        </section>
      </main>

      <footer className="l-footer">
        <div className="l-wrap l-footer__inner">
          <span className="brand">
            <Logo size={20} />
            <span className="brand__name brand__name--sm">{APP_NAME}</span>
          </span>
          <p>Built as a DevOps course project</p>
          <nav aria-label="App">
            <Link to="/board">Board</Link>
            <Link to="/insights">Insights</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
