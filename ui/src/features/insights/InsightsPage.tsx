import { useMemo, useState } from "react";
import { Banner } from "../../components/Banner";
import { CompanyAvatar } from "../../components/CompanyAvatar";
import { Icon } from "../../components/Icon";
import { Skeleton } from "../../components/Skeleton";
import { StageBadge } from "../../components/StageBadge";
import { percent, type StaleItem } from "../../lib/analytics";
import { formatDays, funnelHeadline, slowestStage } from "../../lib/headline";
import { STAGE_META } from "../../lib/stages";
import type { Application } from "../../lib/types";
import { useApplications } from "../../state/applications";
import { Link, useRouter } from "../../state/router";
import { useInsights, type InsightsData } from "../../state/useInsights";
import { FunnelChart } from "./FunnelChart";
import { TimeInStageChart } from "./TimeInStageChart";

const STALE_OPTIONS = [7, 14, 30] as const;

export function InsightsPage() {
  const { applications, status: boardStatus } = useApplications();
  const [staleDays, setStaleDays] = useState<number>(14);
  const version = useMemo(
    () =>
      applications.reduce(
        (h, a) => (h * 31 + a.id * 7 + a.stage.length + a.updated_at.length) >>> 0,
        applications.length,
      ),
    [applications],
  );
  const [state, retry] = useInsights(staleDays, version);
  const data = state.data;
  const firstLoad = state.status === "loading" && !data;

  return (
    <div className="page page--insights">
      <header className="page-header">
        <div className="page-header__text">
          <h1 className="page-title display">Insights</h1>
          <p className="page-subtitle">
            Where applications move, where they stall, and who to nudge
          </p>
        </div>
      </header>

      {state.status === "error" && (
        <Banner title="Insights are temporarily unavailable" onRetry={retry}>
          {data ? "Showing the last numbers we had. " : ""}Your board still works as normal.{" "}
          {state.message}
        </Banner>
      )}

      {firstLoad && <InsightsSkeleton />}

      {data && data.funnel.total === 0 && <EmptyInsights />}

      {data && data.funnel.total > 0 && (
        <div
          className={`insights ${state.status === "loading" ? "is-refreshing" : ""}`}
          aria-busy={state.status === "loading"}
        >
          <Headline data={data} />
          <Kpis data={data} />

          <section className="panel panel--funnel" aria-labelledby="funnel-title">
            <header className="panel__header">
              <h2 id="funnel-title" className="panel__title">
                Funnel
              </h2>
              <p className="panel__subtitle">How far each application got</p>
            </header>
            <FunnelChart funnel={data.funnel} />
          </section>

          <section className="panel panel--time" aria-labelledby="time-title">
            <header className="panel__header">
              <h2 id="time-title" className="panel__title">
                Time in stage
              </h2>
              <p className="panel__subtitle">How long companies take to reply</p>
            </header>
            <TimeInStageChart durations={data.timeInStage} />
          </section>

          <section className="panel panel--stale" aria-labelledby="stale-title">
            <header className="panel__header panel__header--split">
              <div>
                <h2 id="stale-title" className="panel__title">
                  Gone quiet
                </h2>
                <p className="panel__subtitle">Open applications with no movement</p>
              </div>
              <div className="segmented" role="radiogroup" aria-label="Quiet for at least">
                {STALE_OPTIONS.map((days) => (
                  <button
                    key={days}
                    type="button"
                    role="radio"
                    aria-checked={staleDays === days}
                    onClick={() => setStaleDays(days)}
                  >
                    {days}d
                  </button>
                ))}
              </div>
            </header>
            <StaleList
              items={data.stale}
              applications={applications}
              boardReady={boardStatus === "ready"}
              days={staleDays}
            />
          </section>
        </div>
      )}
    </div>
  );
}

function Headline({ data }: { data: InsightsData }) {
  const sentence = funnelHeadline(data.funnel);
  const slow = slowestStage(data.timeInStage);
  if (!sentence && !slow) return null;
  return (
    <section className="headline" aria-label="Summary">
      <p>
        {sentence}
        {slow?.medianDays != null && (
          <>
            {" "}
            {STAGE_META[slow.stage].label} is the slowest stage, at a median of{" "}
            {formatDays(slow.medianDays)}.
          </>
        )}
      </p>
    </section>
  );
}

function Kpis({ data }: { data: InsightsData }) {
  const { funnel } = data;
  const reached = (stage: string) => funnel.steps.find((s) => s.stage === stage)?.count ?? 0;
  const tiles = [
    { label: "Applications", value: String(funnel.total), note: "Tracked so far" },
    {
      label: "Response rate",
      value: `${percent(reached("screen"), funnel.total)}%`,
      note: `${reached("screen")} got a phone screen`,
    },
    {
      label: "Interview rate",
      value: `${percent(reached("interview"), funnel.total)}%`,
      note: `${reached("interview")} reached interviews`,
    },
    {
      label: "Offers",
      value: String(reached("offer")),
      note: `From ${funnel.total} applications`,
    },
  ];
  return (
    <dl className="kpis">
      {tiles.map((tile) => (
        <div key={tile.label} className="kpi">
          <dt>{tile.label}</dt>
          <dd className="kpi__value num">{tile.value}</dd>
          <dd className="kpi__note">{tile.note}</dd>
        </div>
      ))}
    </dl>
  );
}

function StaleList({
  items,
  applications,
  boardReady,
  days,
}: {
  items: StaleItem[];
  applications: Application[];
  boardReady: boolean;
  days: number;
}) {
  const { openApplication } = useRouter();
  const byId = new Map(applications.map((a) => [a.id, a]));
  const rows = items.filter((item) => !boardReady || byId.has(item.application_id));

  if (rows.length === 0) {
    return (
      <div className="stale-empty">
        <Icon name="check" size={20} />
        <p>Everything's moving. Nothing has been quiet for more than {days} days.</p>
      </div>
    );
  }

  return (
    <ul className="stale-list">
      {rows.map((item) => {
        const app = byId.get(item.application_id);
        return (
          <li key={item.application_id}>
            <button
              type="button"
              className="stale-row"
              onClick={() => openApplication(item.application_id)}
            >
              {app ? (
                <CompanyAvatar company={app.company} size={32} />
              ) : (
                <span className="avatar avatar--blank" />
              )}
              <span className="stale-row__titles">
                <span className="stale-row__role">
                  {app?.role ?? `Application #${item.application_id}`}
                </span>
                <span className="stale-row__company">{app?.company ?? "Details unavailable"}</span>
              </span>
              {app && <StageBadge stage={app.stage} />}
              <span className="stale-row__days num">
                <strong>{item.days}</strong> days
              </span>
              <Icon name="chevronRight" size={16} className="stale-row__chevron" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function EmptyInsights() {
  return (
    <section className="empty-state">
      <Icon name="chart" size={28} />
      <h2 className="display">Your insights will grow here</h2>
      <p>
        Add a few applications and move them along. The funnel, reply times and follow-up list fill
        in as you go.
      </p>
      <Link to="/board" className="btn btn--primary btn--md">
        <span className="btn__label">Go to the board</span>
      </Link>
    </section>
  );
}

function InsightsSkeleton() {
  return (
    <div className="insights" aria-busy="true">
      <span className="visually-hidden" role="status">
        Loading insights…
      </span>
      <div className="headline">
        <Skeleton width="70%" height={20} />
      </div>
      <div className="kpis">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="kpi">
            <Skeleton width={90} height={11} />
            <Skeleton width={64} height={30} style={{ margin: "10px 0 8px" }} />
            <Skeleton width={110} height={10} />
          </div>
        ))}
      </div>
      {["funnel", "time", "stale"].map((name) => (
        <div key={name} className={`panel panel--${name}`}>
          <Skeleton width={120} height={14} />
          <div style={{ display: "grid", gap: 14, marginTop: 24 }}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} width={`${90 - i * 18}%`} height={14} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
