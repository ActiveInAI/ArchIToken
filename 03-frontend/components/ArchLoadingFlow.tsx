import { cn } from "@/lib/insome/ui";

export type ArchLoadingFlowSize = "inline" | "compact" | "panel" | "hero";

export function ArchLoadingFlow({
  label = "加载中",
  size = "compact",
  showLabel = false,
  className,
  labelClassName,
}: {
  label?: string;
  size?: ArchLoadingFlowSize;
  showLabel?: boolean;
  className?: string;
  labelClassName?: string;
}) {
  return (
    <span
      role="status"
      aria-busy="true"
      aria-label={label}
      className={cn(
        "arch-loading-flow",
        `arch-loading-flow--${size}`,
        className,
      )}
    >
      <span className="arch-loading-flow__track" aria-hidden="true">
        <span className="arch-loading-flow__spark" />
      </span>
      {showLabel ? (
        <span className={cn("arch-loading-flow__label", labelClassName)}>
          {label}
        </span>
      ) : null}
    </span>
  );
}
