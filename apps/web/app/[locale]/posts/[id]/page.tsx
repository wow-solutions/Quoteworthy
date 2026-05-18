import { getLocale, getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/shell/top-bar";
import { BrandDot } from "@/components/brand/brand-dot";
import type { BrandOption } from "@/components/brand/brand-switcher";
import { brandColor } from "@/lib/brand-color";
import { PublishButton } from "./publish-button";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PostDetailPage({ params }: PageProps) {
  const { id: postId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const t = await getTranslations("posts.detail");
  const locale = await getLocale();

  // RLS scopes to user's brands
  const { data: post } = await supabase
    .from("posts")
    .select(
      "id, brand_id, platform, content_text, status, detection_score, external_post_url, created_at, published_at",
    )
    .eq("id", postId)
    .maybeSingle();
  if (!post) notFound();

  const { data: brandsList } = await supabase
    .from("brands")
    .select("id, name, slug")
    .is("deleted_at", null)
    .order("name");
  const brands = brandsList ?? [];
  const brand = brands.find((b) => b.id === post.brand_id);

  const switcherBrands: BrandOption[] = brands.map((b) => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
  }));

  const color = brand ? brandColor(brand.slug) : "var(--ink-faint)";
  const dateStr = formatDateTime(post.published_at ?? post.created_at, locale);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <TopBar
        brands={switcherBrands}
        currentBrandId={post.brand_id}
        breadcrumbSection={t("breadcrumb")}
        breadcrumbCurrent={brand?.name ?? ""}
      />

      <section style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px" }}>
        <Link
          href="/posts"
          style={{
            fontSize: 13,
            color: "var(--ink-muted)",
            textDecoration: "none",
            display: "inline-block",
            marginBottom: 20,
          }}
        >
          {t("backToList")}
        </Link>

        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 8,
            flexWrap: "wrap",
          }}
        >
          <BrandDot color={color} size={10} />
          <span style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>
            {brand?.name ?? "—"}
          </span>
          <StatusBadge status={post.status} t={t} />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--ink-faint)",
            }}
          >
            {post.platform.toUpperCase()}
          </span>
          {post.detection_score !== null && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--ink-faint)",
              }}
            >
              {t("score", { score: post.detection_score })}
            </span>
          )}
        </div>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--ink-faint)",
            margin: "0 0 24px",
          }}
        >
          {post.status === "published" ? t("publishedAt", { date: dateStr }) : t("createdAt", { date: dateStr })}
        </p>

        {/* Content */}
        <article
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 8,
            padding: "20px 24px",
            marginBottom: 24,
          }}
        >
          <pre
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 15,
              lineHeight: 1.65,
              color: "var(--ink)",
              margin: 0,
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
            }}
          >
            {post.content_text || ""}
          </pre>
        </article>

        {/* Actions */}
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          {post.status === "published" && post.external_post_url ? (
            <a
              href={post.external_post_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: 36,
                padding: "0 16px",
                background: "var(--ink)",
                color: "var(--bg)",
                border: "1px solid var(--ink)",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              {t("viewOnLinkedIn")}
            </a>
          ) : (
            <PublishButton postId={post.id} />
          )}
        </div>
      </section>
    </div>
  );
}

function StatusBadge({ status, t }: { status: string; t: (k: string) => string }) {
  const styles =
    status === "published"
      ? { bg: "var(--pass-bg)", color: "var(--pass)", border: "rgba(122,160,121,0.30)" }
      : status === "pending_approval"
        ? { bg: "var(--borderline-bg)", color: "var(--borderline)", border: "rgba(201,166,107,0.30)" }
        : { bg: "var(--raised)", color: "var(--ink-muted)", border: "var(--border-subtle)" };

  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        background: styles.bg,
        color: styles.color,
        border: `1px solid ${styles.border}`,
        padding: "2px 8px",
        borderRadius: 4,
        fontWeight: 500,
      }}
    >
      {t(`status.${status}`)}
    </span>
  );
}

function formatDateTime(iso: string, locale: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(locale === "ru" ? "ru-RU" : "en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
