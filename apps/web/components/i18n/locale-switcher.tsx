"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import type { Route } from "next";
import { useTransition } from "react";

// Segmented EN / RU switcher. Replaces current URL with the same path under
// the chosen locale. Uses next-intl's locale-aware usePathname/useRouter
// so the path is preserved across the switch.
export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function switchTo(target: string) {
    if (target === locale) return;
    startTransition(() => {
      router.replace(pathname as Route, { locale: target });
    });
  }

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0,
        border: "1px solid var(--border-subtle)",
        borderRadius: 6,
        opacity: isPending ? 0.6 : 1,
      }}
    >
      {routing.locales.map((l, i) => (
        <button
          key={l}
          type="button"
          onClick={() => switchTo(l)}
          aria-current={l === locale ? "true" : undefined}
          style={{
            padding: "4px 10px",
            background: l === locale ? "var(--raised)" : "transparent",
            border: "none",
            borderLeft: i > 0 ? "1px solid var(--border-subtle)" : "none",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            fontWeight: l === locale ? 600 : 400,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: l === locale ? "var(--ink)" : "var(--ink-muted)",
            cursor: l === locale ? "default" : "pointer",
            height: 26,
            lineHeight: 1,
          }}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
