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
import { Textarea } from "@/components/ui/textarea";
import { TagInput } from "@/components/tag-input";
import {
  MAX_VOICE_ARTICLES,
  MAX_VOICE_WORDS,
  countWords,
  truncateWords,
  type WizardData,
} from "../schema";

export function StepVoice() {
  const { control, watch, setValue } = useFormContext<WizardData>();
  const t = useTranslations("wizard.steps.voice");
  const samples = watch("voice_samples") ?? [];
  const { fields, append, remove } = useFieldArray({
    control,
    name: "voice_samples",
  });

  function onArticleChange(idx: number, raw: string) {
    const words = countWords(raw);
    const next =
      words > MAX_VOICE_WORDS ? truncateWords(raw, MAX_VOICE_WORDS) : raw;
    setValue(`voice_samples.${idx}.text` as const, next, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  return (
    <div className="space-y-6">
      <FormField
        control={control}
        name="tone_attributes"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("toneLabel")}</FormLabel>
            <FormDescription>{t("toneDescription")}</FormDescription>
            <FormControl>
              <TagInput
                value={field.value ?? []}
                onChange={field.onChange}
                max={8}
                placeholder={t("tonePlaceholder")}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="brand_voice"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t("voiceLabel")}</FormLabel>
            <FormDescription>{t("voiceDescription")}</FormDescription>
            <FormControl>
              <Textarea
                rows={2}
                maxLength={500}
                placeholder={t("voicePlaceholder")}
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div>
        <FormLabel className="text-base">{t("articlesLabel")}</FormLabel>
        <FormDescription className="mt-1 mb-3">
          {t("articlesDescription", {
            maxArticles: MAX_VOICE_ARTICLES,
            maxWords: MAX_VOICE_WORDS.toLocaleString(),
          })}
        </FormDescription>

        <div className="space-y-3">
          {fields.map((f, idx) => {
            const text = samples[idx]?.text ?? "";
            const wc = countWords(text);
            const overLimit = wc >= MAX_VOICE_WORDS;
            return (
              <div
                key={f.id}
                className="grid gap-2 rounded-md border border-input p-3"
              >
                <FormField
                  control={control}
                  name={`voice_samples.${idx}.text` as const}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs uppercase tracking-wide text-muted-foreground">
                        {t("articleNumber", { n: idx + 1 })}
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          rows={10}
                          placeholder={t("articlePlaceholder")}
                          {...field}
                          onChange={(e) => onArticleChange(idx, e.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {t("wordCount", {
                      current: wc.toLocaleString(),
                      max: MAX_VOICE_WORDS.toLocaleString(),
                    })}
                    {overLimit && (
                      <span className="ml-2 text-amber-500">
                        {t("trimmedSuffix", { max: MAX_VOICE_WORDS.toLocaleString() })}
                      </span>
                    )}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(idx)}
                  >
                    {t("remove")}
                  </Button>
                </div>
              </div>
            );
          })}

          {fields.length < MAX_VOICE_ARTICLES && (
            <Button
              type="button"
              variant="outline"
              onClick={() => append({ text: "", source: "manual" })}
            >
              {t("addArticle", { current: fields.length, max: MAX_VOICE_ARTICLES })}
            </Button>
          )}

          {fields.length === 0 && (
            <p className="text-xs text-muted-foreground">{t("noArticlesHint")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
