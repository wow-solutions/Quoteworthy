"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { deletePost } from "./[id]/actions";

export function DeleteRowButton({ postId }: { postId: string }) {
  const t = useTranslations("posts");
  const tDetail = useTranslations("posts.detail");
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [pending, startDelete] = useTransition();

  function onClick() {
    if (!window.confirm(tDetail("deleteConfirm"))) return;
    setErr(null);
    startDelete(async () => {
      const result = await deletePost(postId);
      if (result.ok) {
        router.refresh();
      } else {
        setErr(result.error);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        style={{
          height: 26,
          padding: "0 10px",
          borderRadius: 4,
          border: "1px solid rgba(194,104,90,0.25)",
          background: "transparent",
          color: "var(--risky)",
          fontSize: 12,
          fontWeight: 500,
          cursor: pending ? "not-allowed" : "pointer",
          opacity: pending ? 0.6 : 1,
        }}
      >
        {pending ? tDetail("deleting") : t("deleteAction")}
      </button>
      {err && (
        <span style={{ fontSize: 11, color: "var(--risky)" }}>{err}</span>
      )}
    </>
  );
}
