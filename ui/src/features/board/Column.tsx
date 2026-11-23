import { useState, type DragEvent } from "react";
import { Icon } from "../../components/Icon";
import { StageDot } from "../../components/StageBadge";
import { STAGE_META, type Stage } from "../../lib/stages";
import type { Application } from "../../lib/types";
import { ApplicationCard } from "./ApplicationCard";
import { useDrag } from "./dnd";

interface ColumnProps {
  stage: Stage;
  apps: Application[];
  total: number;
  filtering: boolean;
  pending: ReadonlySet<number>;
  recentId: number | null;
  disabled: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onOpen: (id: number) => void;
  onMove: (id: number, stage: Stage) => void;
  onAdd: (stage: Stage) => void;
}

export function Column({
  stage,
  apps,
  total,
  filtering,
  pending,
  recentId,
  disabled,
  collapsed,
  onToggleCollapse,
  onOpen,
  onMove,
  onAdd,
}: ColumnProps) {
  const meta = STAGE_META[stage];
  const { drag, setDrag } = useDrag();
  const [over, setOver] = useState(false);
  const canDrop = drag !== null && drag.from !== stage && !disabled;
  const headingId = `column-${stage}`;

  const onDragOver = (event: DragEvent) => {
    if (!canDrop) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (!over) setOver(true);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setOver(false);
    const id = Number(event.dataTransfer.getData("text/plain")) || drag?.id;
    setDrag(null);
    if (id && canDrop) onMove(id, stage);
  };

  const style = {
    ["--stage" as string]: `var(--stage-${stage})`,
    ["--stage-soft" as string]: `var(--stage-${stage}-soft)`,
  };

  if (collapsed) {
    return (
      <section
        className={`column column--collapsed ${over ? "is-over" : ""} ${canDrop ? "can-drop" : ""}`}
        style={style}
        aria-labelledby={headingId}
        onDragOver={onDragOver}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <button
          type="button"
          className="column__rail"
          onClick={onToggleCollapse}
          aria-expanded="false"
          title={`Show ${meta.label}`}
        >
          <StageDot stage={stage} />
          <span id={headingId} className="column__rail-label">
            {meta.label}
          </span>
          <span className="column__count num">{total}</span>
        </button>
      </section>
    );
  }

  return (
    <section
      className={`column ${over ? "is-over" : ""} ${canDrop ? "can-drop" : ""}`}
      style={style}
      aria-labelledby={headingId}
      onDragOver={onDragOver}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false);
      }}
      onDrop={onDrop}
    >
      <header className="column__header">
        <div className="column__title-row">
          <StageDot stage={stage} />
          <h2 id={headingId} className="column__title">
            {meta.label}
          </h2>
          <span
            className="column__count num"
            aria-label={`${apps.length} ${filtering ? `of ${total} ` : ""}applications`}
          >
            {filtering && apps.length !== total ? `${apps.length}/${total}` : total}
          </span>
          <div className="column__tools">
            {onToggleCollapse && (
              <button
                type="button"
                className="icon-btn"
                onClick={onToggleCollapse}
                aria-expanded="true"
                aria-label={`Collapse ${meta.label}`}
                title="Collapse"
              >
                <Icon name="chevronLeft" size={16} />
              </button>
            )}
            <button
              type="button"
              className="icon-btn"
              onClick={() => onAdd(stage)}
              disabled={disabled}
              aria-label={`Add application to ${meta.label}`}
              title={`Add to ${meta.label}`}
            >
              <Icon name="plus" size={16} />
            </button>
          </div>
        </div>
        <p className="column__hint">{meta.hint}</p>
      </header>

      <ol className="column__list" aria-labelledby={headingId}>
        {apps.map((app) => (
          <li key={app.id}>
            <ApplicationCard
              app={app}
              pending={pending.has(app.id)}
              recent={recentId === app.id}
              disabled={disabled}
              onOpen={onOpen}
              onMove={onMove}
            />
          </li>
        ))}
      </ol>

      {apps.length === 0 && (
        <div className="column__empty">
          {canDrop ? (
            <p>Drop here to move to {meta.label}</p>
          ) : (
            <p>{filtering ? "No matches in this stage" : meta.empty}</p>
          )}
        </div>
      )}
    </section>
  );
}
