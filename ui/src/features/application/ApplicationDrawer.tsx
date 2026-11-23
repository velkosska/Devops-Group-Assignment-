import { useEffect, useId, useRef, useState } from "react";
import { Button } from "../../components/Button";
import { CompanyAvatar } from "../../components/CompanyAvatar";
import { Dialog } from "../../components/Dialog";
import { Icon, type IconName } from "../../components/Icon";
import { Skeleton } from "../../components/Skeleton";
import { StageBadge, StageDot } from "../../components/StageBadge";
import { displayHost } from "../../lib/company";
import { formatDate, longAgo } from "../../lib/dates";
import { quietDays } from "../../lib/follow-up";
import { PATH_STAGES, STAGE_META, type Stage } from "../../lib/stages";
import type { Application, StageEvent } from "../../lib/types";
import { toInput, valuesFrom } from "../../lib/validation";
import { useApplications } from "../../state/applications";
import { useBackend } from "../../state/backend";
import { useRouter } from "../../state/router";
import { ApplicationForm } from "./ApplicationForm";

export function ApplicationDrawer() {
  const { appId, openApplication } = useRouter();
  const { get, status } = useApplications();
  const titleId = useId();
  const app = appId !== null ? get(appId) : undefined;
  const lastApp = useRef<Application | undefined>(app);
  if (app) lastApp.current = app;
  const shown = app ?? (appId === null ? lastApp.current : undefined);
  const open = appId !== null && status !== "loading";
  const close = () => openApplication(null);

  return (
    <Dialog open={open} onClose={close} variant="sheet" labelledBy={titleId}>
      {shown ? (
        <DrawerContent key={shown.id} app={shown} titleId={titleId} onClose={close} />
      ) : (
        <div className="drawer drawer--missing">
          <div className="drawer__toolbar">
            <span />
            <Button variant="ghost" icon="x" iconOnly onClick={close}>
              Close
            </Button>
          </div>
          <div className="drawer__missing">
            <Icon name="inbox" size={28} />
            <h2 id={titleId} className="drawer__missing-title">
              This application isn't here anymore
            </h2>
            <p>It may have been deleted. Your other applications are still on the board.</p>
            <Button variant="secondary" onClick={close}>
              Back to the board
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function DrawerContent({
  app,
  titleId,
  onClose,
}: {
  app: Application;
  titleId: string;
  onClose: () => void;
}) {
  const { move, update, remove, pending } = useApplications();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const quiet = quietDays(app);
  const busy = pending.has(app.id);

  const onMove = (stage: Stage) => void move(app.id, stage).catch(() => undefined);

  return (
    <div className="drawer">
      <div className="drawer__toolbar">
        <StageBadge stage={app.stage} />
        <div className="drawer__toolbar-actions">
          {!editing && (
            <Button variant="ghost" size="sm" icon="pencil" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
          <Button variant="ghost" icon="x" iconOnly onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      <header className="drawer__header">
        <CompanyAvatar company={app.company} size={52} />
        <div className="drawer__titles">
          <h2 id={titleId} className="drawer__title">
            {app.role}
          </h2>
          <p className="drawer__company">
            {app.company}
            {app.url && (
              <>
                <span aria-hidden="true"> · </span>
                <a href={app.url} target="_blank" rel="noopener noreferrer" className="text-link">
                  {displayHost(app.url)}
                  <Icon name="external" size={13} />
                  <span className="visually-hidden"> (opens in a new tab)</span>
                </a>
              </>
            )}
          </p>
        </div>
      </header>

      {editing ? (
        <section className="drawer__section" aria-label="Edit details">
          <ApplicationForm
            mode="edit"
            initial={valuesFrom(app)}
            submitLabel="Save changes"
            autoFocus
            onCancel={() => setEditing(false)}
            onSubmit={async (values) => {
              await update(app.id, toInput(values, false));
              setEditing(false);
            }}
          />
        </section>
      ) : (
        <>
          <section className="drawer__section" aria-labelledby={`${titleId}-stage`}>
            <h3 id={`${titleId}-stage`} className="section-label">
              Stage
            </h3>
            <StageStepper stage={app.stage} busy={busy} onMove={onMove} />
          </section>

          {quiet && (
            <div className="nudge" role="note">
              <Icon name="bell" size={18} />
              <div>
                <p className="nudge__title">No movement for {quiet} days</p>
                <p className="nudge__text">
                  A short, friendly follow-up to the recruiter often gets things moving again.
                </p>
              </div>
            </div>
          )}

          <section className="drawer__section" aria-labelledby={`${titleId}-details`}>
            <h3 id={`${titleId}-details`} className="section-label">
              Details
            </h3>
            <dl className="details">
              <Detail
                icon="pin"
                label="Location"
                value={app.location}
                onAdd={() => setEditing(true)}
              />
              <Detail
                icon="money"
                label="Salary range"
                value={app.salary_range}
                onAdd={() => setEditing(true)}
              />
              <Detail
                icon="calendar"
                label="Applied on"
                value={app.applied_at ? formatDate(app.applied_at) : null}
                onAdd={() => setEditing(true)}
              />
              <Detail
                icon="clock"
                label="Last update"
                value={longAgo(app.updated_at).replace(/^./, (c) => c.toUpperCase())}
              />
            </dl>
          </section>

          <Timeline app={app} />
        </>
      )}

      <footer className="drawer__footer">
        {confirmDelete ? (
          <div className="confirm" role="group" aria-label="Confirm delete">
            <p>
              Delete <strong>{app.role}</strong> at {app.company}? This can't be undone.
            </p>
            <div className="confirm__actions">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                autoFocus
              >
                Keep it
              </Button>
              <Button
                variant="danger"
                size="sm"
                icon="trash"
                loading={deleting}
                onClick={async () => {
                  setDeleting(true);
                  onClose();
                  await remove(app.id).catch(() => undefined);
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="danger-ghost"
            size="sm"
            icon="trash"
            onClick={() => setConfirmDelete(true)}
            disabled={editing}
          >
            Delete application
          </Button>
        )}
      </footer>
    </div>
  );
}

function Detail({
  icon,
  label,
  value,
  onAdd,
}: {
  icon: IconName;
  label: string;
  value: string | null;
  onAdd?: () => void;
}) {
  return (
    <div className="details__row">
      <dt>
        <Icon name={icon} size={15} />
        {label}
      </dt>
      <dd>
        {value ??
          (onAdd ? (
            <button type="button" className="text-link text-link--muted" onClick={onAdd}>
              Add
            </button>
          ) : (
            "—"
          ))}
      </dd>
    </div>
  );
}

function StageStepper({
  stage,
  busy,
  onMove,
}: {
  stage: Stage;
  busy: boolean;
  onMove: (stage: Stage) => void;
}) {
  const currentIndex = PATH_STAGES.indexOf(stage);
  const rejected = stage === "rejected";
  return (
    <div className="stepper">
      <ol className={`stepper__path ${rejected ? "is-muted" : ""}`}>
        {PATH_STAGES.map((s, i) => {
          const state = rejected
            ? "todo"
            : i < currentIndex
              ? "done"
              : i === currentIndex
                ? "current"
                : "todo";
          return (
            <li
              key={s}
              className={`stepper__step is-${state}`}
              style={{
                ["--stage" as string]: `var(--stage-${s})`,
                ["--stage-soft" as string]: `var(--stage-${s}-soft)`,
              }}
            >
              <button
                type="button"
                onClick={() => onMove(s)}
                disabled={busy || s === stage}
                aria-current={s === stage ? "step" : undefined}
              >
                <span className="stepper__marker">
                  {state === "done" ? (
                    <Icon name="check" size={12} />
                  ) : (
                    <StageDot stage={s} size={8} />
                  )}
                </span>
                <span className="stepper__label">{STAGE_META[s].label}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="stepper__aside">
        {rejected ? (
          <Button
            size="sm"
            variant="secondary"
            icon="refresh"
            onClick={() => onMove("applied")}
            disabled={busy}
          >
            Reopen
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onMove("rejected")}
            disabled={busy}
            className="btn--reject"
          >
            Mark as rejected
          </Button>
        )}
      </div>
    </div>
  );
}

function Timeline({ app }: { app: Application }) {
  const { insights } = useBackend();
  const [state, setState] = useState<{
    status: "loading" | "ready" | "error" | "absent";
    events: StageEvent[];
  }>({ status: "loading", events: [] });

  useEffect(() => {
    const controller = new AbortController();
    setState((s) => ({ status: "loading", events: s.events }));
    insights
      .timeline(app.id, controller.signal)
      .then((events) =>
        setState(events === null ? { status: "absent", events: [] } : { status: "ready", events }),
      )
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: "error", events: [] });
      });
    return () => controller.abort();
  }, [insights, app.id, app.stage]);

  if (state.status === "absent") return null;

  return (
    <section
      className="drawer__section"
      aria-labelledby={`timeline-${app.id}`}
      aria-busy={state.status === "loading"}
    >
      <h3 id={`timeline-${app.id}`} className="section-label">
        History
      </h3>
      {state.status === "error" && (
        <p className="muted-note">History is unavailable right now. Your board isn't affected.</p>
      )}
      {state.status === "loading" && state.events.length === 0 && (
        <div className="timeline">
          {[0, 1].map((i) => (
            <div key={i} className="timeline__item">
              <Skeleton width={10} height={10} radius={5} />
              <Skeleton width="60%" height={12} />
            </div>
          ))}
        </div>
      )}
      {state.events.length > 0 && (
        <ol className="timeline">
          {[...state.events].reverse().map((event, i) => (
            <li key={`${event.occurred_at}-${i}`} className="timeline__item">
              {event.to_stage && <StageDot stage={event.to_stage} size={10} />}
              <p>
                {event.from_stage === null ? (
                  <>
                    Added to <strong>{event.to_stage && STAGE_META[event.to_stage].label}</strong>
                  </>
                ) : (
                  <>
                    Moved to <strong>{event.to_stage && STAGE_META[event.to_stage].label}</strong>
                  </>
                )}
              </p>
              <time
                dateTime={event.occurred_at}
                title={new Date(event.occurred_at).toLocaleString()}
              >
                {formatDate(event.occurred_at)}
              </time>
            </li>
          ))}
        </ol>
      )}
      {state.status === "ready" && state.events.length === 0 && (
        <p className="muted-note">No stage changes recorded yet.</p>
      )}
    </section>
  );
}
