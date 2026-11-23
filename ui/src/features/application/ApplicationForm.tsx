import { useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { ApiError } from "../../api";
import { Button } from "../../components/Button";
import { Icon, type IconName } from "../../components/Icon";
import { Kbd } from "../../components/Kbd";
import { MOD } from "../../lib/platform";
import { StageDot } from "../../components/StageBadge";
import { companyFromUrl } from "../../lib/company";
import { todayIso } from "../../lib/dates";
import { STAGE_META, STAGES } from "../../lib/stages";
import { validateForm, type ApplicationFormValues, type FieldErrors } from "../../lib/validation";

const FIELD_ORDER: Array<keyof ApplicationFormValues> = [
  "url",
  "company",
  "role",
  "location",
  "salary_range",
  "applied_at",
];

function serverFieldErrors(message: string): FieldErrors {
  const lower = message.toLowerCase();
  for (const field of FIELD_ORDER) {
    if (lower.startsWith(field.replace("_", " ")) || lower.startsWith(field)) {
      return { [field]: message.charAt(0).toUpperCase() + message.slice(1) + "." };
    }
  }
  return {};
}

interface ApplicationFormProps {
  mode: "create" | "edit";
  initial: ApplicationFormValues;
  onSubmit: (values: ApplicationFormValues) => Promise<unknown>;
  onCancel: () => void;
  submitLabel: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function ApplicationForm({
  mode,
  initial,
  onSubmit,
  onCancel,
  submitLabel,
  disabled,
  autoFocus,
}: ApplicationFormProps) {
  const [values, setValues] = useState(initial);
  const [touched, setTouched] = useState<Partial<Record<keyof ApplicationFormValues, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverFields, setServerFields] = useState<FieldErrors>({});
  const [autoCompany, setAutoCompany] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(mode === "edit");
  const formRef = useRef<HTMLFormElement>(null);
  const uid = useId();

  const errors = { ...validateForm(values), ...serverFields };
  const visible = (field: keyof ApplicationFormValues) =>
    (submitted || touched[field]) && errors[field] ? errors[field] : undefined;

  const set = <K extends keyof ApplicationFormValues>(
    field: K,
    value: ApplicationFormValues[K],
  ) => {
    setValues((v) => ({ ...v, [field]: value }));
    setServerFields((s) => ({ ...s, [field]: undefined }));
    if (field === "company") setAutoCompany(null);
  };

  const onUrlChange = (url: string) => {
    setServerFields((s) => ({ ...s, url: undefined }));
    const canFill = values.company.trim() === "" || values.company === autoCompany;
    if (!canFill) {
      setValues((v) => ({ ...v, url }));
      return;
    }
    const guess = companyFromUrl(url);
    setAutoCompany(guess);
    setValues((v) => ({ ...v, url, company: guess ?? "" }));
  };

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (saving || disabled) return;
    setSubmitted(true);
    setServerError(null);
    const found = validateForm(values);
    const firstInvalid = FIELD_ORDER.find((f) => found[f]);
    if (firstInvalid) {
      if (["location", "salary_range", "applied_at"].includes(firstInvalid)) setShowMore(true);
      formRef.current?.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)?.focus();
      return;
    }
    setSaving(true);
    try {
      await onSubmit(values);
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Something unexpected went wrong.";
      const mapped =
        error instanceof ApiError && error.kind === "validation" ? serverFieldErrors(message) : {};
      setServerFields(mapped);
      setServerError(
        Object.keys(mapped).length
          ? null
          : error instanceof ApiError && (error.kind === "timeout" || error.kind === "unavailable")
            ? `${message} Your details are still here, so you can try again.`
            : message,
      );
      setSaving(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void submit();
    }
  };

  const field = (
    name: keyof ApplicationFormValues,
    label: string,
    options: {
      required?: boolean;
      placeholder?: string;
      icon?: IconName;
      type?: string;
      hint?: ReactNode;
      autoFocus?: boolean;
      inputMode?: "url" | "text";
      autoComplete?: string;
      onChange?: (value: string) => void;
    } = {},
  ) => {
    const id = `${uid}-${name}`;
    const error = visible(name);
    const hintId = `${id}-hint`;
    const errorId = `${id}-error`;
    return (
      <div className={`field ${error ? "field--invalid" : ""}`}>
        <label htmlFor={id} className="field__label">
          {label}
          {options.required ? (
            <span className="field__req" aria-hidden="true">
              {" "}
              *
            </span>
          ) : (
            <span className="field__opt">Optional</span>
          )}
        </label>
        <div className="field__control">
          {options.icon && <Icon name={options.icon} size={16} className="field__icon" />}
          <input
            id={id}
            name={name}
            type={options.type ?? "text"}
            inputMode={options.inputMode}
            autoComplete={options.autoComplete ?? "off"}
            value={values[name]}
            placeholder={options.placeholder}
            required={options.required}
            aria-invalid={error ? true : undefined}
            aria-describedby={
              [error && errorId, options.hint && hintId].filter(Boolean).join(" ") || undefined
            }
            max={options.type === "date" ? todayIso() : undefined}
            onChange={(e) => (options.onChange ?? ((v: string) => set(name, v)))(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, [name]: true }))}
            autoFocus={options.autoFocus}
            className={options.icon ? "has-icon" : undefined}
          />
        </div>
        {error ? (
          <p id={errorId} className="field__error">
            <Icon name="alert" size={14} /> {error}
          </p>
        ) : (
          options.hint && (
            <p id={hintId} className="field__hint">
              {options.hint}
            </p>
          )
        )}
      </div>
    );
  };

  return (
    <form ref={formRef} className="app-form" onSubmit={submit} onKeyDown={onKeyDown} noValidate>
      {serverError && (
        <div className="form-alert" role="alert">
          <Icon name="alert" size={16} />
          <span>{serverError}</span>
        </div>
      )}

      {field("url", "Job posting link", {
        placeholder: "Paste a link to fill in the company",
        icon: "link",
        inputMode: "url",
        autoComplete: "url",
        autoFocus: autoFocus && mode === "create",
        onChange: onUrlChange,
      })}

      <div className="field-row">
        {field("company", "Company", {
          required: true,
          placeholder: "e.g. Northwind",
          autoComplete: "organization",
          autoFocus: autoFocus && mode === "edit",
          hint:
            autoCompany && values.company === autoCompany ? (
              <>Filled in from the link, edit if it's not right</>
            ) : undefined,
        })}
        {field("role", "Role", {
          required: true,
          placeholder: "e.g. Frontend Engineer",
          autoComplete: "organization-title",
        })}
      </div>

      {mode === "create" && (
        <fieldset className="field stage-picker">
          <legend className="field__label">Stage</legend>
          <div className="stage-picker__options">
            {STAGES.map((stage) => (
              <label
                key={stage}
                className="stage-option"
                style={{
                  ["--stage" as string]: `var(--stage-${stage})`,
                  ["--stage-soft" as string]: `var(--stage-${stage}-soft)`,
                }}
              >
                <input
                  type="radio"
                  name="stage"
                  value={stage}
                  checked={values.stage === stage}
                  onChange={() => set("stage", stage)}
                />
                <StageDot stage={stage} />
                <span>{STAGE_META[stage].label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {showMore ? (
        <div className="more-fields">
          <div className="field-row">
            {field("location", "Location", { placeholder: "City, or Remote", icon: "pin" })}
            {field("salary_range", "Salary range", { placeholder: "e.g. €50–60k", icon: "money" })}
          </div>
          <div className="field-row">
            {field("applied_at", "Applied on", { type: "date", icon: "calendar" })}
            <div aria-hidden="true" />
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="more-toggle"
          aria-expanded="false"
          onClick={() => {
            setShowMore(true);
            requestAnimationFrame(() =>
              formRef.current?.querySelector<HTMLElement>('[name="location"]')?.focus(),
            );
          }}
        >
          <Icon name="plus" size={14} />
          Add location, salary or date
          <span className="more-toggle__hint">Applied today unless you change it</span>
        </button>
      )}

      <div className="app-form__footer">
        <span className="app-form__shortcut">
          <Kbd>{MOD}</Kbd>
          <Kbd>↵</Kbd> to save
        </span>
        <div className="app-form__actions">
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving} disabled={disabled}>
            {saving ? (mode === "create" ? "Adding…" : "Saving…") : submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
