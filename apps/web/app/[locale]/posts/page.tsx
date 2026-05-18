import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/shell/top-bar";
import { BrandDot } from "@/components/brand/brand-dot";
import type { BrandOption } from "@/components/brand/brand-switcher";
import { brandColor } from "@/lib/brand-color";

type PageProps = {
  searchParams: Promise<{ status?: string; brand?: string }>;
};

const STATUS_OPTIONS = ["all", "draft", "pending_approval", "published"] as const;
type StatusFilter = (typeof STATUS_OPTIONS)[number];

export default async function PostsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const statusFilter: StatusFilter = STATUS_OPTIONS.includes(sp.status as StatusFilter)
    ? (sp.status as StatusFilter)
    : "all";
  const brandFilter = sp.brand ?? null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const t = await getTranslations("posts");
  const locale = await getLocale();

  // Fetch brands for switcher + name lookup
  const { data: brandsList } = await supabase
    .from("brands")
    .select("id, name, slug")
    .is("deleted_at", null)
    .order("name");

  const brands = brandsList ?? [];
  const brandById = new Map(brands.map((b) => [b.id, b]));

  // Fetch posts (RLS-scoped — user sees only own brand posts)
  let q = supabase
    .from("posts")
    .select(
      "id, brand_id, platform, content_text, status, detection_score, external_post_url, created_at, published_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (statusFilter !== "all") {
    q = q.eq("status", statusFilter);
  }
  if (brandFilter) {
    q = q.eq("brand_id", brandFilter);
  }
  const { data: posts } = await q;
  const list = posts ?? [];

  const switcherBrands: BrandOption[] = brands.map((b) => ({
    id: b.id,
    name: b.name,
    slug: b.slug,
  }));

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <TopBar
        brands={switcherBrands}
        currentBrandId={brandFilter}
        breadcrumbSection={t("breadcrumb")}
      />

      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginBottom: 24,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 600,
                letterSpacing: "-0.022em",
                color: "var(--ink)",
                margin: 0,
              }}
            >
              {t("title")}
            </h1>
            <p
              style={{
                marginTop: 6,
                fontSize: 13,
                color: "var(--ink-muted)",
              }}
            >
              {t("subtitle", { count: list.length })}
            </p>
          </div>
        </div>

        {/* Status filter chips */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
          {STATUS_OPTIONS.map((s) => {
            const active = s === statusFilter;
            const href =
              s === "all"
                ? brandFilter
                  ? `/posts?brand=${brandFilter}`
                  : "/posts"
                : brandFilter
                  ? `/posts?status=${s}&brand=${brandFilter}`
                  : `/posts?status=${s}`;
            return (
              <Link
                key={s}
                href={href}
                style={{
                  height: 26,
                  padding: "0 10px",
                  borderRadius: 14,
                  border: "1px solid var(--border-subtle)",
                  background: active ? "var(--ink)" : "transparent",
                  color: active ? "var(--bg)" : "var(--ink-muted)",
                  fontSize: 12,
                  fontWeight: 500,
                  display: "inline-flex",
                  alignItems: "center",
                  textDecoration: "none",
                }}
              >
                {t(`filter.${s}`)}
              </Link>
            );
          })}
        </div>

        {list.length === 0 ? (
          <EmptyState title={t("empty.title")} body={t("empty.body")} cta={t("empty.cta")} />
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
            {list.map((p) => {
              const brand = brandById.get(p.brand_id);
              const color = brand ? brandColor(brand.slug) : "var(--ink-faint)";
              const dateStr = formatDate(
                p.published_at ?? p.created_at,
                locale,
              );
              const preview = (p.content_text ?? "").slice(0, 140).trim();

              return (
                <li
                  key={p.id}
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: 8,
                    padding: "14px 16px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginBottom: 8,
                    }}
                  >
                    <BrandDot color={color} size={8} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>
                      {brand?.name ?? "—"}
                    </span>
                    <StatusBadge status={p.status} t={t} />
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        color: "var(--ink-faint)",
                      }}
                    >
                      {p.platform.toUpperCase()}
                    </span>
                    {p.detection_score !== null && (
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 11,
                          color: "var(--ink-faint)",
                        }}
                      >
                        · {t("scoreLabel", { score: p.detection_score })}
                      </span>
                    )}
                    <span
                      style={{
                        marginLeft: "auto",
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        color: "var(--ink-faint)",
                      }}
                    >
                      {dateStr}
                    </span>
                  </div>

                  <p
                    style={{
                      fontSize: 13,
                      color: "var(--ink-muted)",
                      lineHeight: 1.5,
                      margin: "0 0 12px",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {preview || <em>{t("emptyContent")}</em>}
                    {(p.content_text?.length ?? 0) > 140 && "…"}
                  </p>

                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <Link
                      href={`/posts/${p.id}`}
                      style={{
                        height: 26,
                        padding: "0 10px",
                        borderRadius: 4,
                        border: "1px solid var(--border-subtle)",
                        background: "transparent",
                        color: "var(--ink)",
                        fontSize: 12,
                        fontWeight: 500,
                        display: "inline-flex",
                        alignItems: "center",
                        textDecoration: "none",
                      }}
                    >
                      {t("openAction")}
                    </Link>
                    {p.external_post_url && (
                      <a
                        href={p.external_post_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: 12,
                          color: "var(--info)",
                          textDecoration: "underline",
                        }}
                      >
                        {t("viewOnLinkedIn")}
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatusBadge({
  status,
  t,
}: {
  status: string;
  t: (k: string) => string;
}) {
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

function EmptyState({ title, body, cta }: { title: string; body: string; cta: string }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px dashed var(--border-strong)",
        borderRadius: 12,
        padding: "48px 32px",
        textAlign: "center",
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-serif)",
          fontStyle: "italic",
          fontSize: 24,
          color: "var(--ink-muted)",
          margin: 0,
          marginBottom: 6,
          letterSpacing: "-0.02em",
        }}
      >
        {title}
      </p>
      <p style={{ fontSize: 13, color: "var(--ink-muted)", margin: "0 0 20px", maxWidth: 420, marginInline: "auto" }}>
        {body}
      </p>
      <Link
        href="/dashboard"
        style={{
          display: "inline-flex",
          alignItems: "center",
          height: 32,
          padding: "0 14px",
          background: "var(--ink)",
          color: "var(--bg)",
          border: "1px solid var(--ink)",
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 500,
          textDecoration: "none",
        }}
      >
        {cta}
      </Link>
    </div>
  );
}

function formatDate(iso: string, locale: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(locale === "ru" ? "ru-RU" : "en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
