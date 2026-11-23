import { useId } from "react";
import { Dialog } from "../../components/Dialog";
import { Button } from "../../components/Button";
import { useApplications } from "../../state/applications";
import { STAGE_META, type Stage } from "../../lib/stages";
import { emptyValues, toInput } from "../../lib/validation";
import { ApplicationForm } from "./ApplicationForm";

interface Props {
  open: boolean;
  stage: Stage;
  onClose: () => void;
}

export function NewApplicationDialog({ open, stage, onClose }: Props) {
  const titleId = useId();
  const { create, status } = useApplications();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      variant="center"
      className="dialog--form"
    >
      <header className="dialog__header">
        <div>
          <h2 id={titleId} className="dialog__title">
            New application
          </h2>
          <p className="dialog__subtitle">
            {stage === "applied"
              ? "Only company and role are needed. You can add the rest later."
              : `It'll go straight into ${STAGE_META[stage].label}.`}
          </p>
        </div>
        <Button variant="ghost" icon="x" iconOnly onClick={onClose}>
          Close
        </Button>
      </header>
      <ApplicationForm
        key={`${open}-${stage}`}
        mode="create"
        initial={emptyValues(stage)}
        submitLabel="Add application"
        autoFocus
        disabled={status === "error"}
        onCancel={onClose}
        onSubmit={async (values) => {
          await create(toInput(values, true));
          onClose();
        }}
      />
    </Dialog>
  );
}
