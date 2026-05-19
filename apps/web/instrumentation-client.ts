import * as Sentry from "@sentry/nextjs";

// In dev, disable Sentry browser tracing. Its wrapping of performance.measure
// collides with React's RSC perf instrumentation in Next.js 16 + Turbopack,
// surfacing a noisy TypeError in flushComponentPerformance. Errors still get
// captured when DSN is set; only tracing is off locally.
const isProd = process.env.NEXT_PUBLIC_VERCEL_ENV === "production";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
  tracesSampleRate: isProd ? 1.0 : 0,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
