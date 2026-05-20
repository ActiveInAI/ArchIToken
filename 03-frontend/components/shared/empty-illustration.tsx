export type EmptyVariant = "no-projects" | "no-floorplan" | "empty-canvas";

export interface EmptyIllustrationProps {
  readonly variant: EmptyVariant;
  readonly accent?: "signal" | "lime";
  readonly size?: number;
}

export function EmptyIllustration({
  variant,
  accent = "signal",
  size = 96,
}: EmptyIllustrationProps) {
  const stroke = accent === "lime" ? "#D4FF3A" : "#FF4B1F";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      stroke={stroke}
      strokeWidth={1.5}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {variant === "no-projects" ? (
        <g>
          <rect x="12" y="20" width="72" height="56" />
          <line x1="12" y1="32" x2="84" y2="32" />
          <circle cx="20" cy="26" r="1.5" fill={stroke} stroke="none" />
          <circle cx="28" cy="26" r="1.5" fill={stroke} stroke="none" />
          <rect x="22" y="44" width="20" height="16" opacity="0.5" />
          <rect x="50" y="44" width="20" height="16" opacity="0.5" />
        </g>
      ) : null}
      {variant === "no-floorplan" ? (
        <g>
          <rect x="16" y="24" width="64" height="48" />
          <line x1="48" y1="24" x2="48" y2="72" />
          <line x1="16" y1="48" x2="80" y2="48" />
          <line x1="28" y1="48" x2="32" y2="48" strokeWidth="3" opacity="0.6" />
        </g>
      ) : null}
      {variant === "empty-canvas" ? (
        <g>
          <rect x="8" y="8" width="80" height="80" strokeDasharray="4 4" opacity="0.6" />
          <line x1="40" y1="48" x2="56" y2="48" />
          <line x1="48" y1="40" x2="48" y2="56" />
        </g>
      ) : null}
    </svg>
  );
}
