"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { cn } from "@/lib/insome/ui";

export type ArchLoadingFlowSize = "inline" | "compact" | "panel" | "hero";

const AUTO_PROGRESS_START = 8;
const AUTO_PROGRESS_LIMIT = 95;
const RAINBOW_BRIDGE_ARCH_COUNT = 5;
const RAINBOW_BRIDGE_START_X = 10;
const RAINBOW_BRIDGE_SPAN = 44;
const RAINBOW_BRIDGE_BASELINE = 30;
const RAINBOW_BRIDGE_OUTER_RADIUS = 22;
const RAINBOW_BRIDGE_STRIPES = [
  { color: "#ff2f2f", glow: "#ff8a7a", shade: "#c81e1e", radius: 22 },
  { color: "#ff8a1c", glow: "#ffc078", shade: "#c75a00", radius: 19.2 },
  { color: "#ffd43b", glow: "#fff08a", shade: "#c49a00", radius: 16.4 },
  { color: "#2fd05f", glow: "#86efac", shade: "#15803d", radius: 13.6 },
  { color: "#22d3ee", glow: "#a5f3fc", shade: "#0891b2", radius: 10.8 },
  { color: "#3b82f6", glow: "#93c5fd", shade: "#1d4ed8", radius: 8 },
  { color: "#8b5cf6", glow: "#c4b5fd", shade: "#6d28d9", radius: 5.2 },
] as const;
const RAINBOW_BRIDGE_FLOW_DURATION_SECONDS = 0.8;
const RAINBOW_BRIDGE_GRADIENT_WIDTH = 96;

function rainbowBridgePath({ radius }: { radius: number }) {
  return Array.from({ length: RAINBOW_BRIDGE_ARCH_COUNT }, (_, index) => {
    const centerX =
      RAINBOW_BRIDGE_START_X +
      index * RAINBOW_BRIDGE_SPAN +
      RAINBOW_BRIDGE_OUTER_RADIUS;
    const startX = centerX - radius;
    const endX = centerX + radius;
    const move = index === 0 ? `M ${startX} ${RAINBOW_BRIDGE_BASELINE}` : "";
    const bridge = index > 0 ? `L ${startX} ${RAINBOW_BRIDGE_BASELINE}` : "";
    return `${move} ${bridge} A ${radius} ${radius} 0 0 1 ${endX} ${RAINBOW_BRIDGE_BASELINE}`;
  }).join(" ");
}

export function ArchLoadingFlow({
  label = "加载中",
  size = "compact",
  showLabel = false,
  showProgress = false,
  progress,
  className,
  labelClassName,
}: {
  label?: string;
  size?: ArchLoadingFlowSize;
  showLabel?: boolean;
  showProgress?: boolean;
  progress?: number;
  className?: string;
  labelClassName?: string;
}) {
  const gradientIdPrefix = useId().replace(/:/g, "");
  const [autoProgress, setAutoProgress] = useState(AUTO_PROGRESS_START);
  const displayProgress = useMemo(() => {
    if (typeof progress === "number" && Number.isFinite(progress)) {
      return Math.max(0, Math.min(100, Math.round(progress)));
    }
    return autoProgress;
  }, [autoProgress, progress]);
  const statusLabel = showProgress ? `${label} ${displayProgress}%` : label;

  useEffect(() => {
    if (!showProgress) return;
    if (typeof progress === "number" && Number.isFinite(progress)) return;
    const timer = window.setInterval(() => {
      setAutoProgress((current) => {
        if (current >= AUTO_PROGRESS_LIMIT) return AUTO_PROGRESS_START;
        const remaining = AUTO_PROGRESS_LIMIT - current;
        const nextStep = Math.max(2, Math.ceil(remaining * 0.12));
        return Math.min(AUTO_PROGRESS_LIMIT, current + nextStep);
      });
    }, 320);
    return () => window.clearInterval(timer);
  }, [progress, showProgress]);

  return (
    <span
      role="status"
      aria-busy="true"
      aria-label={statusLabel}
      className={cn(
        "arch-loading-flow",
        `arch-loading-flow--${size}`,
        className,
      )}
    >
      <span className="arch-loading-flow__track" aria-hidden="true">
        <svg
          className="arch-loading-flow__bridge"
          viewBox="0 0 240 34"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {RAINBOW_BRIDGE_STRIPES.map((stripe, index) => (
              <linearGradient
                key={`gradient-${stripe.color}`}
                id={`${gradientIdPrefix}-stripe-${index}`}
                x1="0"
                y1="0"
                x2={RAINBOW_BRIDGE_GRADIENT_WIDTH}
                y2="0"
                gradientUnits="userSpaceOnUse"
                spreadMethod="repeat"
                colorInterpolation="sRGB"
              >
                <stop offset="0%" stopColor={stripe.shade} />
                <stop offset="18%" stopColor={stripe.color} />
                <stop offset="48%" stopColor={stripe.glow} />
                <stop offset="70%" stopColor={stripe.color} />
                <stop offset="100%" stopColor={stripe.shade} />
                <animateTransform
                  className="arch-loading-flow__gradient-motion"
                  attributeName="gradientTransform"
                  type="translate"
                  from="0 0"
                  to={`${RAINBOW_BRIDGE_GRADIENT_WIDTH} 0`}
                  dur={`${RAINBOW_BRIDGE_FLOW_DURATION_SECONDS}s`}
                  repeatCount="indefinite"
                />
              </linearGradient>
            ))}
          </defs>
          {RAINBOW_BRIDGE_STRIPES.map((stripe, index) => (
            <path
              key={`stripe-${stripe.color}`}
              className="arch-loading-flow__stripe"
              d={rainbowBridgePath(stripe)}
              stroke={`url(#${gradientIdPrefix}-stripe-${index})`}
              pathLength={1}
            />
          ))}
        </svg>
        <span className="arch-loading-flow__spark" />
        {showProgress ? (
          <span key={displayProgress} className="arch-loading-flow__progress">
            {displayProgress}%
          </span>
        ) : null}
      </span>
      {showLabel ? (
        <span className={cn("arch-loading-flow__label", labelClassName)}>
          {label}
        </span>
      ) : null}
    </span>
  );
}
