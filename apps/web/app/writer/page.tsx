import { getBrandFromRequest } from "@/lib/get-brand";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/shell/top-bar";
import { BrandContextStrip } from "@/components/brand/brand-context-strip";
import type { BrandOption } from "@/components/brand/brand-switcher";
import { WriterClient } from "./writer-client";

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function WriterPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { brand, userId } = await getBrandFromRequest(params);

  const supabase = await createClient();

  const [
    { data: allBrands },
    { data: allConfigs },
    { data: allPosts },
    { data: account },
  ] = await Promise.all([
    supabase
      .from("brands")
      .select("id, name, slug")
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("brand_configs")
      .select(
        "brand_id, brand_voice, tone_attributes, forbidden_words, voc_pain_points, seo_keywords_primary",
      ),
    supabase.from("posts").select("brand_id"),
    supabase
      .from("accounts")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  const brandsList = allBrands ?? [];
  const configsList = allConfigs ?? [];
  const postsList = allPosts ?? [];

  const postCounts: Record<string, number> = {};
  for (const p of postsList) {
    postCounts[p.brand_id] = (postCounts[p.brand_id] ?? 0) + 1;
  }

  const switcherBrands: BrandOption[] = brandsList.map((b) => {
    const cfg = configsList.find((c) => c.brand_id === b.id);
    return {
      id: b.id,
      name: b.name,
      slug: b.slug,
      postCount: postCounts[b.id] ?? 0,
      toneSummary: formatToneSummary(cfg?.tone_attributes ?? []),
    };
  });

  const currentConfig = configsList.find((c) => c.brand_id === brand.id);
  const currentPostCount = postCounts[brand.id] ?? 0;
  const voiceSummary = formatToneSummary(currentConfig?.tone_attributes ?? []);

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
        brands={switcherBrands}
        currentBrandId={brand.id}
        breadcrumbSection="Writer"
        userInitials={userInitials}
        newPostHref={`/writer?brand=${brand.id}`}
      />
      <BrandContextStrip
        brand={{
          id: brand.id,
          name: brand.name,
          slug: brand.slug,
          voiceSummary,
          postCount: currentPostCount,
        }}
      />
      <WriterClient
        brandId={brand.id}
        brandName={brand.name}
        brandConfig={{
          brandVoice: currentConfig?.brand_voice ?? null,
          toneAttributes: currentConfig?.tone_attributes ?? [],
          forbiddenWords: currentConfig?.forbidden_words ?? [],
          seoKeywords: currentConfig?.seo_keywords_primary ?? [],
        }}
      />
    </div>
  );
}

function formatToneSummary(toneAttributes: string[]): string | undefined {
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
