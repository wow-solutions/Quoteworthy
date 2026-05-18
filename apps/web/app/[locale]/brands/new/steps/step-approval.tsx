"use client";

import { useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import type { WizardData } from "../schema";

export function StepApproval() {
  const { control } = useFormContext<WizardData>();
  const t = useTranslations("wizard.steps.approval");

  const options: Array<{ value: "manual" | "auto"; title: string; description: string }> = [
    {
      value: "manual",
      title: t("manualTitle"),
      description: t("manualBody"),
    },
    {
      value: "auto",
      title: t("autoTitle"),
      description: t("autoBody"),
    },
  ];

  return (
    <FormField
      control={control}
      name="approval_mode"
      render={({ field }) => (
        <FormItem className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("intro")}</p>
          <FormControl>
            <div className="grid gap-3">
              {options.map((opt) => {
                const selected = field.value === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => field.onChange(opt.value)}
                    className={`text-left rounded-md border p-4 transition-colors ${
                      selected
                        ? "border-foreground bg-accent"
                        : "border-input hover:border-foreground/50"
                    }`}
                  >
                    <div className="font-medium">{opt.title}</div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {opt.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
