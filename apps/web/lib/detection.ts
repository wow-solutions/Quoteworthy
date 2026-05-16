export type DetectionBucket = "risky" | "borderline" | "pass";

export function scoreBucket(score: number): DetectionBucket {
  if (score >= 70) return "pass";
  if (score >= 40) return "borderline";
  return "risky";
}

export function bucketLabel(bucket: DetectionBucket): string {
  if (bucket === "pass") return "Passes";
  if (bucket === "borderline") return "Borderline";
  return "Reads as AI";
}

export function bucketCssVar(bucket: DetectionBucket): string {
  return `var(--${bucket})`;
}
