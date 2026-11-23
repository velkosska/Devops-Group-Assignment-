import { useEffect, useMemo, useRef, useState } from "react";
import { Banner } from "../../components/Banner";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { Kbd } from "../../components/Kbd";
import { Skeleton } from "../../components/Skeleton";
import { StageDot } from "../../components/StageBadge";
import { matchesQuery, quietDays } from "../../lib/follow-up";
import { isFinal, STAGE_META, STAGES, type Stage } from "../../lib/stages";
import type { Application } from "../../lib/types";
import { useMediaQuery } from "../../lib/useMediaQuery";
import { useApplications } from "../../state/applications";
import { useRouter } from "../../state/router";
import { Column } from "./Column";
import { DragContext, type DragState } from "./dnd";
import { EmptyBoard } from "./EmptyBoard";

const COLLAPSE_KEY = "shortlist.board.collapsed";

function readCollapsed(): Stage[] {
  try {
    const stored = localStorage.getItem(COLLAPSE_KEY);
    if (stored === null) return ["rejected"];
    const raw = JSON.parse(stored);
    return Array.isArray(raw)
      ? raw.filter((s): s is Stage => (STAGES as readonly string[]).includes(s))
      : [];
  } catch {
    return ["rejected"];
  }
}

const byRecent = (a: Application, b: Application) =>
  Date.parse(b.updated_at) - Date.parse(a.updated_at);

interface BoardPageProps {
  onAdd: (stage: Stage) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
}

export function BoardPage({ onAdd, searchRef }: BoardPageProps) {
  const { status, applications, slow, outage, error, pending, recentId, reload, move } =
    useApplications();
  const { openApplication } = useRouter();
  const [query, setQuery] = useState("");
  const [onlyQuiet, setOnlyQuiet] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [collapsed, setCollapsed] = useState<Stage[]>(readCollapsed);
  const compact = useMediaQuery("(max-width: 760px)");
  const [mobileStage, setMobileStage] = useState<Stage>("applied");
  const dragValue = useMemo(() => ({ drag, setDrag }), [drag]);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, JSON.stringify(collapsed));
    } catch {
      return;
    }
  }, [collapsed]);

  const quietCount = useMemo(
    () => applications.filter((a) => quietDays(a) !== null).length,
    [applications],
  );
  const active = applications.filter((a) => !isFinal(a.stage)).length;
  const filtering = query.trim() !== "" || onlyQuiet;

  const columns = useMemo(() => {
    const visible = applications.filter(
      (a) => matchesQuery(a, query) && (!onlyQuiet || quietDays(a) !== null),
    );
    return STAGES.map((stage) => ({
      stage,
      apps: visible.filter((a) => a.stage === stage).sort(byRecent),
      total: applications.filter((a) => a.stage === stage).length,
    }));
  }, [applications, query, onlyQuiet]);
  const matches = columns.reduce((n, c) => n + c.apps.length, 0);

  useEffect(() => {
    if (onlyQuiet && quietCount === 0) setOnlyQuiet(false);
  }, [onlyQuiet, quietCount]);

  const onMove = (id: number, stage: Stage) => void move(id, stage).catch(() => undefined);
  const toggle = (stage: Stage) =>
    setCollapsed((c) => (c.includes(stage) ? c.filter((s) => s !== stage) : [...c, stage]));
  const unavailable = status === "error";

  if (status === "ready" && applications.length === 0) {
    return (
      <div className="page page--board">
        {outage && <OutageBanner onRetry={reload} />}
        <EmptyBoard onAdd={() => onAdd("applied")} />
      </div>
    );
  }

  return (
    <div className="page page--board">
      <header className="page-header">
        <div className="page-header__text">
          <h1 className="page-title display">Pipeline</h1>
          {status === "ready" ? (
            <p className="page-subtitle">
              <span className="num">{applications.length}</span> applications ·{" "}
              <span className="num">{active}</span> in progress
              {quietCount > 0 && (
                <>
                  {" · "}
                  <button
                    type="button"
                    className="text-link text-link--attention"
                    onClick={() => setOnlyQuiet(true)}
                  >
                    {quietCount} gone quiet
                  </button>
                </>
              )}
            </p>
          ) : (
            <Skeleton width={260} height={14} style={{ marginTop: 8 }} />
          )}
        </div>
        <div className="page-header__actions">
          <Button
            variant="primary"
            icon="plus"
            onClick={() => onAdd("applied")}
            disabled={unavailable}
            className="hide-compact"
          >
            New application
            <Kbd>N</Kbd>
          </Button>
        </div>
      </header>

      {unavailable && (
        <Banner title="Applications are temporarily unavailable" onRetry={reload}>
          {error ?? "We couldn't load your board."} Nothing is lost. Try again in a moment.
        </Banner>
      )}
      {!unavailable && outage && <OutageBanner onRetry={reload} />}

      {status !== "error" && (
        <div className="toolbar" role="search">
          <div className="search">
            <Icon name="search" size={16} className="search__icon" />
            <label htmlFor="board-search" className="visually-hidden">
              Search applications
            </label>
            <input
              ref={searchRef}
              id="board-search"
              type="search"
              placeholder="Search company, role or location"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape" && query) {
                  e.stopPropagation();
                  setQuery("");
                }
              }}
              disabled={status !== "ready"}
            />
            {!query && <Kbd>/</Kbd>}
          </div>
          <div className="filter-chips" role="group" aria-label="Filter">
            <button
              type="button"
              className="filter-chip"
              aria-pressed={!onlyQuiet}
              onClick={() => setOnlyQuiet(false)}
            >
              All
            </button>
            <button
              type="button"
              className="filter-chip filter-chip--attention"
              aria-pressed={onlyQuiet}
              onClick={() => setOnlyQuiet(true)}
              disabled={quietCount === 0}
            >
              <span className="chip__dot" /> Needs follow-up
              <span className="num filter-chip__count">{quietCount}</span>
            </button>
          </div>
          {filtering && (
            <p className="toolbar__result" role="status">
              {matches === 0 ? "No matches" : `${matches} shown`}
              <button
                type="button"
                className="text-link"
                onClick={() => {
                  setQuery("");
                  setOnlyQuiet(false);
                }}
              >
                Clear
              </button>
            </p>
          )}
        </div>
      )}

      {status === "loading" && <BoardSkeleton slow={slow} compact={compact} />}

      {status === "ready" && compact && (
        <MobileBoard
          columns={columns}
          stage={mobileStage}
          onStage={setMobileStage}
          filtering={filtering}
          pending={pending}
          recentId={recentId}
          onOpen={(id) => openApplication(id)}
          onMove={onMove}
          onAdd={onAdd}
        />
      )}

      {status === "ready" && !compact && (
        <DragContext.Provider value={dragValue}>
          <div className={`board ${drag ? "is-dragging" : ""}`}>
            {columns.map(({ stage, apps, total }) => (
              <Column
                key={stage}
                stage={stage}
                apps={apps}
                total={total}
                filtering={filtering}
                pending={pending}
                recentId={recentId}
                disabled={false}
                collapsed={stage === "rejected" && collapsed.includes(stage)}
                onToggleCollapse={stage === "rejected" ? () => toggle(stage) : undefined}
                onOpen={(id) => openApplication(id)}
                onMove={onMove}
                onAdd={onAdd}
              />
            ))}
          </div>
        </DragContext.Provider>
      )}
    </div>
  );
}

function OutageBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <Banner title="Applications are temporarily unavailable" onRetry={onRetry}>
      Your last change didn't reach the server. Try again in a moment.
    </Banner>
  );
}

function BoardSkeleton({ slow, compact }: { slow: boolean; compact: boolean }) {
  return (
    <div aria-busy="true" aria-live="polite">
      {slow && (
        <p className="waking" role="status">
          <span className="waking__pulse" /> Waking up the server. The first load after a quiet
          spell can take a few seconds.
        </p>
      )}
      <span className="visually-hidden">Loading your board…</span>
      <div className="board board--skeleton">
        {(compact ? STAGES.slice(0, 1) : STAGES).map((stage, i) => (
          <div key={stage} className="column">
            <div className="column__header">
              <div className="column__title-row">
                <StageDot stage={stage} />
                <span className="column__title">{STAGE_META[stage].label}</span>
              </div>
            </div>
            <div className="column__list">
              {Array.from({ length: Math.max(1, 3 - Math.floor(i / 2)) }, (_, j) => (
                <div key={j} className="card card--skeleton">
                  <div className="card__head">
                    <Skeleton width={34} height={34} radius={9} />
                    <div style={{ flex: 1, display: "grid", gap: 6 }}>
                      <Skeleton width="80%" height={12} />
                      <Skeleton width="50%" height={10} />
                    </div>
                  </div>
                  <Skeleton width="40%" height={10} style={{ marginTop: 14 }} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface MobileBoardProps {
  columns: Array<{ stage: Stage; apps: Application[]; total: number }>;
  stage: Stage;
  onStage: (stage: Stage) => void;
  filtering: boolean;
  pending: ReadonlySet<number>;
  recentId: number | null;
  onOpen: (id: number) => void;
  onMove: (id: number, stage: Stage) => void;
  onAdd: (stage: Stage) => void;
}

function MobileBoard({ columns, stage, onStage, ...rest }: MobileBoardProps) {
  const tabsRef = useRef<HTMLDivElement>(null);
  const current = columns.find((c) => c.stage === stage)!;

  useEffect(() => {
    tabsRef.current
      ?.querySelector<HTMLElement>('[aria-selected="true"]')
      ?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [stage]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    const index = STAGES.indexOf(stage);
    const nextIndex =
      event.key === "ArrowRight" ? index + 1 : event.key === "ArrowLeft" ? index - 1 : null;
    if (nextIndex === null) return;
    event.preventDefault();
    const target = STAGES[(nextIndex + STAGES.length) % STAGES.length];
    onStage(target);
    tabsRef.current?.querySelector<HTMLElement>(`#tab-${target}`)?.focus();
  };

  return (
    <div className="mobile-board">
      <div
        ref={tabsRef}
        className="stage-tabs"
        role="tablist"
        aria-label="Stages"
        onKeyDown={onKeyDown}
      >
        {columns.map((c) => (
          <button
            key={c.stage}
            id={`tab-${c.stage}`}
            type="button"
            role="tab"
            aria-selected={c.stage === stage}
            aria-controls="stage-panel"
            tabIndex={c.stage === stage ? 0 : -1}
            className="stage-tab"
            style={{ ["--stage" as string]: `var(--stage-${c.stage})` }}
            onClick={() => onStage(c.stage)}
          >
            <StageDot stage={c.stage} />
            {STAGE_META[c.stage].label}
            <span className="num stage-tab__count">{rest.filtering ? c.apps.length : c.total}</span>
          </button>
        ))}
      </div>
      <div
        id="stage-panel"
        role="tabpanel"
        aria-labelledby={`tab-${stage}`}
        className="mobile-board__panel"
      >
        <Column
          stage={stage}
          apps={current.apps}
          total={current.total}
          disabled={false}
          {...rest}
        />
      </div>
    </div>
  );
}
