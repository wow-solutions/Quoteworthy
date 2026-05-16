import Link from "next/link";
import { QuoteworthyMark } from "./quoteworthy-mark";
import { BrandDot } from "@/components/brand/brand-dot";
import { brandColor } from "@/lib/brand-color";

type BrandSummary = {
  id: string;
  name: string;
  slug: string;
  postCount?: number;
};

type Props = {
  brand: BrandSummary | null;
  breadcrumbSection?: string;
  breadcrumbCurrent?: string;
  userInitials?: string;
  newPostHref?: string;
};

export function TopBar({
  brand,
  breadcrumbSection,
  breadcrumbCurrent,
  userInitials = "—",
  newPostHref = "/writer",
}: Props) {
  return (
    <header
      style={{
        display: "grid",
        gridTemplateColumns: "auto auto 1fr auto auto",
        alignItems: "center",
        gap: 14,
        padding: "0 16px",
        borderBottom: "1px solid var(--border-subtle)",
        background: "var(--bg)",
        height: "var(--shell-topbar-h)",
      }}
    >
      <Link
        href="/dashboard"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          paddingRight: 14,
          borderRight: "1px solid var(--border-subtle)",
          height: 32,
        }}
      >
        <QuoteworthyMark size={28} />
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: "-0.015em",
            color: "var(--ink)",
          }}
        >
          Quoteworthy
        </span>
      </Link>

      {brand ? (
        <Link
          href={`/dashboard?brand=${brand.id}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            height: 32,
            padding: "0 10px 0 8px",
            background: "var(--surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 6,
            fontSize: 13,
            color: "var(--ink)",
            minWidth: 232,
          }}
        >
          <BrandDot color={brandColor(brand.slug)} />
          <span
            style={{
              flex: 1,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontWeight: 500,
            }}
          >
            {brand.name}
          </span>
          {typeof brand.postCount === "number" && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--ink-faint)",
                marginLeft: 2,
              }}
            >
              {brand.postCount} posts
            </span>
          )}
          <span
            aria-hidden
            style={{
              color: "var(--ink-faint)",
              fontSize: 10,
              lineHeight: 1,
            }}
          >
            ▾
          </span>
        </Link>
      ) : (
        <div />
      )}

      <nav
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          color: "var(--ink-muted)",
        }}
      >
        {breadcrumbSection && <span>{breadcrumbSection}</span>}
        {breadcrumbSection && breadcrumbCurrent && (
          <span style={{ color: "var(--ink-faint)" }}>/</span>
        )}
        {breadcrumbCurrent && (
          <span style={{ color: "var(--ink)" }}>{breadcrumbCurrent}</span>
        )}
      </nav>

      <Link
        href={newPostHref}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          height: 32,
          padding: "0 12px",
          background: "var(--ink)",
          color: "var(--bg)",
          border: "1px solid var(--ink)",
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 500,
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        New post
      </Link>

      <div
        title="Account"
        aria-label="Account"
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #6E8FA8, #4A6F8F)",
          display: "grid",
          placeItems: "center",
          fontSize: 11,
          fontWeight: 600,
          color: "#fff",
        }}
      >
        {userInitials.slice(0, 2).toUpperCase()}
      </div>
    </header>
  );
}
