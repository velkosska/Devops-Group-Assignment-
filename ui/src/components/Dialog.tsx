import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  variant?: "center" | "sheet";
  labelledBy: string;
  children: ReactNode;
  className?: string;
  initialFocus?: RefObject<HTMLElement | null>;
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function Dialog({
  open,
  onClose,
  variant = "center",
  labelledBy,
  children,
  className,
  initialFocus,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const returnFocus = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocus.current = document.activeElement as HTMLElement | null;
      dialog.classList.remove("is-closing");
      dialog.showModal();
      document.documentElement.classList.add("has-modal");
      if (initialFocus?.current) initialFocus.current.focus();
      else if (variant === "sheet") dialog.querySelector<HTMLElement>(".dialog__panel")?.focus();
    } else if (!open && dialog.open) {
      const finish = () => {
        dialog.classList.remove("is-closing");
        dialog.close();
        setMounted(false);
        document.documentElement.classList.remove("has-modal");
        const target = returnFocus.current;
        if (target && document.contains(target)) target.focus();
      };
      if (prefersReducedMotion() || typeof dialog.getAnimations !== "function") {
        finish();
      } else {
        dialog.classList.add("is-closing");
        const done = () => finish();
        dialog.addEventListener("animationend", done, { once: true });
        const timer = setTimeout(done, 300);
        return () => clearTimeout(timer);
      }
    }
  }, [open, initialFocus, variant]);

  useEffect(() => {
    return () => document.documentElement.classList.remove("has-modal");
  }, []);

  return (
    <dialog
      ref={ref}
      className={`dialog dialog--${variant} ${className ?? ""}`}
      aria-labelledby={labelledBy}
      onCancel={(event) => {
        event.preventDefault();
        onCloseRef.current();
      }}
      onMouseDown={(event) => {
        if (event.target === ref.current) onCloseRef.current();
      }}
    >
      {(open || mounted) && (
        <div className="dialog__panel" tabIndex={-1}>
          {children}
        </div>
      )}
    </dialog>
  );
}
