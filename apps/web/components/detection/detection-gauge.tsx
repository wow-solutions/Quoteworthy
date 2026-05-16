"use client";

import { scoreBucket, bucketLabel, bucketCssVar } from "@/lib/detection";

type Size = "sm" | "md" | "lg";

const SIZE_PX: Record<Size, number> = { sm: 64, md: 120, lg: 180 };
const VALUE_FONT: Record<Size, number> = { sm: 22, md: 36, lg: 52 };

type Props = {
  score: number | null;
  size?: Size;
  label?: boolean;
};

export function DetectionGauge({ score, size = "md", label = true }: Props) {
  const px = SIZE_PX[size];
  const valueFont = VALUE_FONT[size];
  const r = 52;
  const circumference = 2 * Math.PI * r;

  const clampedScore =
    score === null ? 0 : Math.max(0, Math.min(100, Math.round(score)));
  const bucket = score === null ? "risky" : scoreBucket(clampedScore);
  const color = score === null ? "var(--ink-faint)" : bucketCssVar(bucket);
  const offset = circumference * (1 - clampedScore / 100);
  const display = score === null ? "—" : clampedScore;

  return (
    <div
      role="img"
      aria-label={
        score === null
          ? "Detection pass score: not yet run"
          : `Detection pass score: ${clampedScore} of 100, ${bucketLabel(bucket)}`
      }
      style={{
        width: px,
        height: px,
        display: "grid",
        placeItems: "center",
        position: "relative",
      }}
    >
      <svg
        viewBox="0 0 120 120"
        style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}
      >
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth="6"
        />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 800ms cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          textAlign: "center",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: valueFont,
              fontWeight: 500,
              letterSpacing: "-0.02em",
              color,
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {display}
          </div>
          {label && (
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--ink-faint)",
                marginTop: 6,
              }}
            >
              {score === null ? "Not run" : bucketLabel(bucket)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
