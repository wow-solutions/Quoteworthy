"use client";

import { useFieldArray, useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
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
import { TagInput } from "@/components/tag-input";
import type { WizardData } from "../schema";

function QuoteList({
  name,
  quotePlaceholder,
}: {
  name: "voc_pain_points" | "voc_desired_outcomes";
  quotePlaceholder: string;
}) {
  const { control, register } = useFormContext<WizardData>();
  const t = useTranslations("wizard.steps.voc");
  const { fields, append, remove } = useFieldArray({ control, name });
  return (
    <div className="space-y-3">
      {fields.map((f, idx) => (
        <div key={f.id} className="grid gap-2 rounded-md border border-input p-3">
          <FormField
            control={control}
            name={`${name}.${idx}.quote` as const}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t("quoteLabel")}
                </FormLabel>
                <FormControl>
                  <Textarea rows={2} placeholder={quotePlaceholder} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex gap-2">
            <Input
              placeholder={t("sourcePlaceholder")}
              {...register(`${name}.${idx}.source` as const)}
            />
            <Button type="button" variant="ghost" onClick={() => remove(idx)}>
              {t("remove")}
            </Button>
          </div>
        </div>
      ))}
      {fields.length < 10 && (
        <Button
          type="button"
          variant="outline"
          onClick={() => append({ quote: "", source: "" })}
        >
          {t("addQuote", { current: fields.length, max: 10 })}
        </Button>
      )}
    </div>
  );
}

export function StepVoc() {
  const { control } = useFormContext<WizardData>();
  const t = useTranslations("wizard.steps.voc");
  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-medium mb-1">{t("painTitle")}</h3>
        <p className="text-sm text-muted-foreground mb-3">{t("painBody")}</p>
        <QuoteList
          name="voc_pain_points"
          quotePlaceholder={t("painPlaceholder")}
        />
      </div>

      <div>
        <h3 className="font-medium mb-1">{t("outcomesTitle")}</h3>
        <p className="text-sm text-muted-foreground mb-3">{t("outcomesBody")}</p>
        <QuoteList
          name="voc_desired_outcomes"
          quotePlaceholder={t("outcomesPlaceholder")}
        />
      </div>

      <FormField
        control={control}
        name="trigger_events"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("triggersLabel")}</FormLabel>
            <FormDescription>{t("triggersDescription")}</FormDescription>
            <FormControl>
              <TagInput
                value={field.value ?? []}
                onChange={field.onChange}
                max={10}
                placeholder={t("triggersPlaceholder")}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
