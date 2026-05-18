import { Link } from "@/i18n/navigation";
import { QuoteworthyMark } from "./quoteworthy-mark";
import { BrandSwitcher, type BrandOption } from "@/components/brand/brand-switcher";
import { LocaleSwitcher } from "@/components/i18n/locale-switcher";

type Props = {
  brands: BrandOption[];
  currentBrandId: string | null;
  breadcrumbSection?: string;
  breadcrumbCurrent?: string;
  userInitials?: string;
  newPostHref?: string;
};

export function TopBar({
  brands,
  currentBrandId,
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

      <BrandSwitcher brands={brands} currentBrandId={currentBrandId} />

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

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <LocaleSwitcher />
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
      </div>
    </header>
  );
}
