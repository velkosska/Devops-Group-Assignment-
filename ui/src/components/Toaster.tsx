import { useToasts } from "../state/toasts";
import { Icon } from "./Icon";

export function Toaster() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className="toaster" role="region" aria-label="Notifications">
      <ol aria-live="polite" aria-relevant="additions">
        {toasts.map((toast) => (
          <li key={toast.id} className={`toast toast--${toast.tone ?? "neutral"}`}>
            {toast.tone === "success" && <Icon name="check" size={16} className="toast__icon" />}
            {toast.tone === "error" && <Icon name="alert" size={16} className="toast__icon" />}
            <span className="toast__message">{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                className="toast__action"
                onClick={() => {
                  toast.action!.run();
                  dismiss(toast.id);
                }}
              >
                {toast.action.label}
              </button>
            )}
            <button
              type="button"
              className="toast__close"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss"
            >
              <Icon name="x" size={14} />
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
