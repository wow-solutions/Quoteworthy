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

export function StepWordGuards() {
  const { control } = useFormContext<WizardData>();
  const t = useTranslations("wizard.steps.wordGuards");
  return (
    <div className="space-y-4">
      <FormField
        control={control}
        name="forbidden_words"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("forbiddenLabel")}</FormLabel>
            <FormDescription>{t("forbiddenDescription")}</FormDescription>
            <FormControl>
              <TagInput
                value={field.value ?? []}
                onChange={field.onChange}
                max={50}
                placeholder={t("forbiddenPlaceholder")}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="required_phrases"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("requiredLabel")}</FormLabel>
            <FormDescription>{t("requiredDescription")}</FormDescription>
            <FormControl>
              <TagInput
                value={field.value ?? []}
                onChange={field.onChange}
                max={20}
                placeholder={t("requiredPlaceholder")}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
