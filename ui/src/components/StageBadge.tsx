import { STAGE_META, type Stage } from "../lib/stages";

export function StageDot({ stage, size = 8 }: { stage: Stage; size?: number }) {
  return (
    <span
      className="stage-dot"
      aria-hidden="true"
      style={{ width: size, height: size, background: `var(--stage-${stage})` }}
    />
  );
}

export function StageBadge({ stage }: { stage: Stage }) {
  return (
    <span
      className="stage-badge"
      style={{
        ["--stage" as string]: `var(--stage-${stage})`,
        ["--stage-soft" as string]: `var(--stage-${stage}-soft)`,
      }}
    >
      <StageDot stage={stage} size={6} />
      {STAGE_META[stage].label}
    </span>
  );
}
