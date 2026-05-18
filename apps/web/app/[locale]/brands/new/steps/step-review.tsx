"use client";

import { useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";
import type { WizardData } from "../schema";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 py-2 border-b border-border last:border-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="col-span-2 text-sm">{value || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}

function List({ items }: { items: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it, i) => (
        <span
          key={i}
          className="rounded bg-muted px-2 py-0.5 text-xs"
        >
          {it}
        </span>
      ))}
    </div>
  );
}

export function StepReview() {
  const { getValues } = useFormContext<WizardData>();
  const t = useTranslations("wizard.steps.review");
  const v = getValues();

  return (
    <div className="space-y-6">
      <section>
        <h3 className="font-medium mb-2">{t("sectionBasics")}</h3>
        <dl>
          <Row label={t("name")} value={v.name} />
          <Row label={t("slug")} value={v.slug} />
          <Row label={t("website")} value={v.website_url} />
          <Row label={t("industry")} value={v.industry} />
          <Row label={t("language")} value={v.primary_language} />
          <Row label={t("description")} value={v.description} />
        </dl>
      </section>

      <section>
        <h3 className="font-medium mb-2">{t("sectionVoice")}</h3>
        <dl>
          <Row label={t("brandVoice")} value={v.brand_voice} />
          <Row label={t("tone")} value={<List items={v.tone_attributes} />} />
          <Row
            label={t("voiceArticles")}
            value={
              v.voice_samples.length
                ? t("articleCount", { count: v.voice_samples.length })
                : ""
            }
          />
          <Row label={t("forbidden")} value={<List items={v.forbidden_words} />} />
          <Row label={t("required")} value={<List items={v.required_phrases} />} />
        </dl>
      </section>

      <section>
        <h3 className="font-medium mb-2">{t("sectionVoc")}</h3>
        <dl>
          <Row
            label={t("painPoints")}
            value={
              v.voc_pain_points.length
                ? t("quoteCount", { count: v.voc_pain_points.length })
                : ""
            }
          />
          <Row
            label={t("desiredOutcomes")}
            value={
              v.voc_desired_outcomes.length
                ? t("quoteCount", { count: v.voc_desired_outcomes.length })
                : ""
            }
          />
          <Row label={t("triggers")} value={<List items={v.trigger_events} />} />
        </dl>
      </section>

      <section>
        <h3 className="font-medium mb-2">{t("sectionSeo")}</h3>
        <dl>
          <Row label={t("primary")} value={<List items={v.seo_keywords_primary} />} />
          <Row label={t("secondary")} value={<List items={v.seo_keywords_secondary} />} />
        </dl>
      </section>

      <section>
        <h3 className="font-medium mb-2">{t("sectionOps")}</h3>
        <dl>
          <Row label={t("approvalMode")} value={v.approval_mode} />
        </dl>
      </section>
    </div>
  );
}
