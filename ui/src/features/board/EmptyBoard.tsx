import { Button } from "../../components/Button";
import { Kbd } from "../../components/Kbd";
import { StageDot } from "../../components/StageBadge";
import { PATH_STAGES, STAGE_META } from "../../lib/stages";

export function EmptyBoard({ onAdd }: { onAdd: () => void }) {
  return (
    <section className="onboarding" aria-labelledby="onboarding-title">
      <div className="onboarding__art" aria-hidden="true">
        {PATH_STAGES.map((stage, i) => (
          <div
            key={stage}
            className="onboarding__step"
            style={{
              ["--i" as string]: i,
              ["--stage" as string]: `var(--stage-${stage})`,
              ["--stage-soft" as string]: `var(--stage-${stage}-soft)`,
            }}
          >
            <StageDot stage={stage} />
            <span>{STAGE_META[stage].label}</span>
          </div>
        ))}
      </div>
      <h1 id="onboarding-title" className="onboarding__title display">
        Start your shortlist
      </h1>
      <p className="onboarding__text">
        Add each job you apply for, then move it along as you hear back. You'll see where things
        stall and which companies have gone quiet.
      </p>
      <div className="onboarding__actions">
        <Button variant="primary" size="lg" icon="plus" onClick={onAdd}>
          Add your first application
        </Button>
        <span className="onboarding__hint">
          or press <Kbd>N</Kbd> anytime
        </span>
      </div>
    </section>
  );
}
