import { getBrandFromRequest } from "@/lib/get-brand";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/shell/top-bar";
import { BrandContextStrip } from "@/components/brand/brand-context-strip";
import { WriterClient } from "./writer-client";

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function WriterPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { brand, userId } = await getBrandFromRequest(params);

  const supabase = await createClient();

  const [{ data: brandConfig }, { data: account }, { count: postCount }] =
    await Promise.all([
      supabase
        .from("brand_configs")
        .select(
          "brand_voice, tone_attributes, forbidden_words, voc_pain_points, seo_keywords_primary",
        )
        .eq("brand_id", brand.id)
        .maybeSingle(),
      supabase
        .from("accounts")
        .select("display_name")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("posts")
        .select("id", { count: "exact", head: true })
        .eq("brand_id", brand.id),
    ]);

  const voiceSummary = formatVoiceSummary(brandConfig?.tone_attributes ?? []);

  const accountDisplayName = account?.display_name ?? "";
  const userInitials = makeInitials(accountDisplayName);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows:
          "var(--shell-topbar-h) var(--shell-context-h) 1fr",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <TopBar
        brand={{
          id: brand.id,
          name: brand.name,
          slug: brand.slug,
          postCount: postCount ?? 0,
        }}
        breadcrumbSection="Writer"
        userInitials={userInitials}
      />
      <BrandContextStrip
        brand={{
          id: brand.id,
          name: brand.name,
          slug: brand.slug,
          voiceSummary,
          postCount: postCount ?? 0,
        }}
      />
      <WriterClient
        brandId={brand.id}
        brandName={brand.name}
        brandConfig={{
          brandVoice: brandConfig?.brand_voice ?? null,
          toneAttributes: brandConfig?.tone_attributes ?? [],
          forbiddenWords: brandConfig?.forbidden_words ?? [],
          seoKeywords: brandConfig?.seo_keywords_primary ?? [],
        }}
      />
    </div>
  );
}

function formatVoiceSummary(toneAttributes: string[]): string | undefined {
  if (toneAttributes.length === 0) return undefined;
  return toneAttributes
    .slice(0, 3)
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase())
    .join(" · ");
}

function makeInitials(name: string): string {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
