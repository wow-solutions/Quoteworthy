"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

type Stage = "idle" | "publishing" | "error";

export function PublishButton({ postId }: { postId: string }) {
  const t = useTranslations("posts.detail");
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function onClick() {
    setError(null);
    setStage("publishing");

    let res: Response;
    try {
      res = await fetch(`/api/posts/${postId}/publish`, { method: "POST" });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("networkError"));
      setStage("error");
      return;
    }

    const data = (await res.json().catch(() => null)) as
      | { success?: boolean; url?: string; error?: string; needsReconnect?: boolean }
      | null;

    if (!res.ok || !data?.success) {
      const msg = data?.error ?? `HTTP ${res.status}`;
      const reconnectNote = data?.needsReconnect ? ` · ${t("reconnect")}` : "";
      setError(`${msg}${reconnectNote}`);
      setStage("error");
      return;
    }

    // Refresh the page to show published state and the LinkedIn link
    startTransition(() => {
      router.refresh();
    });
  }

  const busy = stage === "publishing" || isPending;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        style={{
          height: 36,
          padding: "0 16px",
          background: busy ? "var(--ink-faint)" : "var(--ink)",
          color: "var(--bg)",
          border: "1px solid var(--ink)",
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 500,
          cursor: busy ? "not-allowed" : "pointer",
          opacity: busy ? 0.7 : 1,
        }}
      >
        {busy ? t("publishing") : t("publishNow")}
      </button>
      {error && (
        <div
          style={{
            padding: "8px 10px",
            borderRadius: 6,
            background: "var(--risky-bg)",
            color: "var(--risky)",
            border: "1px solid rgba(194,104,90,0.20)",
            fontSize: 12,
            lineHeight: 1.4,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
