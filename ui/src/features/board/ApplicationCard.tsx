import { memo, useState, type DragEvent } from "react";
import { CompanyAvatar } from "../../components/CompanyAvatar";
import { Icon } from "../../components/Icon";
import { Menu } from "../../components/Menu";
import { StageDot } from "../../components/StageBadge";
import { longAgo, shortAgo } from "../../lib/dates";
import { quietDays } from "../../lib/follow-up";
import { adjacentStage, STAGE_META, STAGES, type Stage } from "../../lib/stages";
import type { Application } from "../../lib/types";
import { useDrag } from "./dnd";

interface CardProps {
  app: Application;
  pending: boolean;
  recent: boolean;
  disabled: boolean;
  onOpen: (id: number) => void;
  onMove: (id: number, stage: Stage) => void;
}

export const ApplicationCard = memo(function ApplicationCard({
  app,
  pending,
  recent,
  disabled,
  onOpen,
  onMove,
}: CardProps) {
  const { setDrag } = useDrag();
  const [dragging, setDragging] = useState(false);
  const quiet = quietDays(app);
  const prev = adjacentStage(app.stage, -1);
  const next = adjacentStage(app.stage, 1);

  const onDragStart = (event: DragEvent) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(app.id));
    setDrag({ id: app.id, from: app.stage });
    requestAnimationFrame(() => setDragging(true));
  };

  const onDragEnd = () => {
    setDragging(false);
    setDrag(null);
  };

  const classes = [
    "card",
    dragging && "is-dragging",
    pending && "is-pending",
    recent && "is-recent",
    quiet && "is-quiet",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article
      className={classes}
      draggable={!disabled}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      data-stage={app.stage}
    >
      <button type="button" className="card__open" onClick={() => onOpen(app.id)}>
        <span className="visually-hidden">
          {app.role} at {app.company}, {STAGE_META[app.stage].label}
          {quiet ? `, no movement for ${quiet} days` : ""}. Open details.
        </span>
      </button>

      <div className="card__head">
        <CompanyAvatar company={app.company} size={34} />
        <div className="card__titles">
          <p className="card__role">{app.role}</p>
          <p className="card__company">{app.company}</p>
        </div>
      </div>

      {(app.location || app.salary_range) && (
        <p className="card__meta">
          {app.location && (
            <span>
              <Icon name="pin" size={13} />
              {app.location}
            </span>
          )}
          {app.salary_range && (
            <span>
              <Icon name="money" size={13} />
              {app.salary_range}
            </span>
          )}
        </p>
      )}

      <div className="card__foot">
        {quiet ? (
          <span
            className="chip chip--attention"
            title={`No movement for ${quiet} days. Time to follow up?`}
          >
            <span className="chip__dot" /> Quiet {quiet}d
          </span>
        ) : (
          <span className="chip" title={`Updated ${longAgo(app.updated_at)}`}>
            <Icon name="clock" size={12} />
            {shortAgo(app.updated_at)}
          </span>
        )}

        <div className="card__actions">
          {prev && (
            <button
              type="button"
              className="card__action"
              disabled={disabled || pending}
              onClick={() => onMove(app.id, prev)}
              aria-label={`Move back to ${STAGE_META[prev].label}`}
              title={`Back to ${STAGE_META[prev].label}`}
            >
              <Icon name="chevronLeft" size={16} />
            </button>
          )}
          {next && (
            <button
              type="button"
              className="card__action"
              disabled={disabled || pending}
              onClick={() => onMove(app.id, next)}
              aria-label={`Move forward to ${STAGE_META[next].label}`}
              title={`Forward to ${STAGE_META[next].label}`}
            >
              <Icon name="chevronRight" size={16} />
            </button>
          )}
          <Menu
            label={`Move ${app.company}`}
            items={STAGES.map((stage) => ({
              key: stage,
              current: stage === app.stage,
              disabled: stage === app.stage || disabled,
              onSelect: () => onMove(app.id, stage),
              label: (
                <>
                  <StageDot stage={stage} />
                  <span>{STAGE_META[stage].label}</span>
                  {stage === app.stage && <Icon name="check" size={14} className="menu__check" />}
                </>
              ),
            }))}
            trigger={(props) => (
              <button
                type="button"
                className="card__action"
                disabled={disabled || pending}
                aria-label={`Move ${app.company} to another stage`}
                title="Move to…"
                {...props}
              >
                <Icon name="more" size={16} />
              </button>
            )}
          />
        </div>
      </div>
    </article>
  );
});
