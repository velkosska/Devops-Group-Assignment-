import type { ReactNode } from "react";
import { Button } from "./Button";
import { Icon, type IconName } from "./Icon";

interface BannerProps {
  tone?: "warning" | "info";
  title: string;
  children?: ReactNode;
  onRetry?: () => void;
  retrying?: boolean;
  icon?: IconName;
}

export function Banner({
  tone = "warning",
  title,
  children,
  onRetry,
  retrying,
  icon,
}: BannerProps) {
  return (
    <div className={`banner banner--${tone}`} role={tone === "warning" ? "alert" : "status"}>
      <Icon name={icon ?? "alert"} className="banner__icon" />
      <div className="banner__body">
        <p className="banner__title">{title}</p>
        {children && <p className="banner__text">{children}</p>}
      </div>
      {onRetry && (
        <Button size="sm" variant="secondary" icon="refresh" onClick={onRetry} loading={retrying}>
          Try again
        </Button>
      )}
    </div>
  );
}
