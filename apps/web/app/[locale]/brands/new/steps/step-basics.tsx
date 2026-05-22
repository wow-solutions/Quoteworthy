"use client";

import { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { useTranslations, useLocale } from "next-intl";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IndustryPicker } from "@/components/industry-picker";
import { slugify, type WizardData } from "../schema";

export function StepBasics() {
  const { control, watch, setValue, getValues } = useFormContext<WizardData>();
  const t = useTranslations("wizard.steps.basics");
  const locale = useLocale();
  const name = watch("name");

  // Auto-fill slug from name until the user touches the slug field manually.
  useEffect(() => {
    const currentSlug = getValues("slug");
    const autoSlug = slugify(name ?? "");
    if (!currentSlug || currentSlug === slugify(getValues("name") ?? "")) {
      setValue("slug", autoSlug, { shouldValidate: false });
    }
  }, [name, getValues, setValue]);

  return (
    <div className="space-y-4">
      <FormField
        control={control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("nameLabel")}</FormLabel>
            <FormDescription>{t("nameDescription")}</FormDescription>
            <FormControl>
              <Input placeholder={t("namePlaceholder")} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="slug"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("slugLabel")}</FormLabel>
            <FormDescription>{t("slugDescription")}</FormDescription>
            <FormControl>
              <Input placeholder={t("slugPlaceholder")} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="website_url"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("websiteLabel")}</FormLabel>
            <FormDescription>
              {t.rich("websiteDescription", {
                code: (chunks) => <code>{chunks}</code>,
              })}
            </FormDescription>
            <FormControl>
              <Input placeholder={t("websitePlaceholder")} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="industry_category_id"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("industryLabel")}</FormLabel>
            <FormDescription>{t("industryDescription")}</FormDescription>
            <FormControl>
              <IndustryPicker
                value={field.value ?? null}
                onChange={(id, displayName) => {
                  field.onChange(id ?? undefined);
                  setValue("industry_display_name", displayName ?? "", {
                    shouldValidate: false,
                  });
                }}
                brandId={null}
                locale={locale}
                initialDisplayName={getValues("industry_display_name")}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="primary_language"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("languageLabel")}</FormLabel>
            <FormDescription>{t("languageDescription")}</FormDescription>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="ru">Русский</SelectItem>
                <SelectItem value="pt">Português</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("descriptionLabel")}</FormLabel>
            <FormDescription>{t("descriptionDescription")}</FormDescription>
            <FormControl>
              <Textarea
                rows={2}
                placeholder={t("descriptionPlaceholder")}
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
