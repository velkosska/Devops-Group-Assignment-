import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "danger-ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  icon?: IconName;
  trailing?: ReactNode;
  loading?: boolean;
  iconOnly?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "secondary",
    size = "md",
    icon,
    trailing,
    loading,
    iconOnly,
    children,
    className,
    disabled,
    type,
    ...rest
  },
  ref,
) {
  const classes = ["btn", `btn--${variant}`, `btn--${size}`, iconOnly && "btn--icon", className]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      aria-label={iconOnly && typeof children === "string" ? children : rest["aria-label"]}
      title={iconOnly && typeof children === "string" ? children : rest.title}
      {...rest}
    >
      {loading ? (
        <Spinner size={size === "sm" ? 14 : 16} />
      ) : (
        icon && <Icon name={icon} size={size === "sm" ? 16 : 18} />
      )}
      {!iconOnly && <span className="btn__label">{children}</span>}
      {trailing}
    </button>
  );
});
