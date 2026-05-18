"use client";

import { useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { TagInput } from "@/components/tag-input";
import type { WizardData } from "../schema";

export function StepSeo() {
  const { control } = useFormContext<WizardData>();
  const t = useTranslations("wizard.steps.seo");
  return (
    <div className="space-y-5">
      <div className="rounded-md border border-dashed border-amber-700 bg-amber-950/20 px-4 py-3 text-sm text-amber-200">
        <p className="font-medium mb-1">{t("optionalTitle")}</p>
        <p className="text-amber-200/80">{t("optionalBody")}</p>
      </div>

      <FormField
        control={control}
        name="seo_keywords_primary"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("primaryLabel")}</FormLabel>
            <FormDescription>{t("primaryDescription")}</FormDescription>
            <FormControl>
              <TagInput
                value={field.value ?? []}
                onChange={field.onChange}
                max={15}
                placeholder={t("primaryPlaceholder")}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="seo_keywords_secondary"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("secondaryLabel")}</FormLabel>
            <FormDescription>{t("secondaryDescription")}</FormDescription>
            <FormControl>
              <TagInput
                value={field.value ?? []}
                onChange={field.onChange}
                max={30}
                placeholder={t("secondaryPlaceholder")}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
