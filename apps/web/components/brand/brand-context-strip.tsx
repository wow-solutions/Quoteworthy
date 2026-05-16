import Link from "next/link";
import { BrandDot } from "./brand-dot";
import { brandColor } from "@/lib/brand-color";

type Props = {
  brand: {
    id: string;
    name: string;
    slug: string;
    voiceSummary?: string;
    postCount?: number;
    lastActivity?: string;
  };
  viewBrandHref?: string;
};

export function BrandContextStrip({ brand, viewBrandHref }: Props) {
  const color = brandColor(brand.slug);

  return (
    <div
      style={{
        height: "var(--shell-context-h)",
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        borderBottom: "1px solid var(--border-subtle)",
        background: "var(--bg)",
        position: "relative",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: -1,
          height: 2,
          background: color,
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          flex: 1,
          minWidth: 0,
        }}
      >
        <BrandDot color={color} />
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--ink)",
            whiteSpace: "nowrap",
          }}
        >
          {brand.name}
        </span>
        {brand.voiceSummary && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--ink-faint)",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              paddingLeft: 14,
              borderLeft: "1px solid var(--border-subtle)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {brand.voiceSummary}
          </span>
        )}
      </div>
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        {typeof brand.postCount === "number" && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--ink-faint)",
              letterSpacing: "0.02em",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {brand.postCount} POSTS
          </span>
        )}
        {brand.lastActivity && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--ink-faint)",
              letterSpacing: "0.02em",
            }}
          >
            LAST {brand.lastActivity}
          </span>
        )}
        {viewBrandHref && (
          <Link
            href={viewBrandHref}
            style={{
              fontSize: 13,
              color: "var(--ink-muted)",
              fontWeight: 500,
              padding: "0 8px",
              height: 26,
              display: "inline-flex",
              alignItems: "center",
              borderRadius: 6,
            }}
          >
            View brand →
          </Link>
        )}
      </div>
    </div>
  );
}
