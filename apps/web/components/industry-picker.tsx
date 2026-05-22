"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
} from "@/components/ui/command";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type SearchResult = {
  id: string;
  name_en: string;
  name_ru: string;
  industry_group: string;
  similarity: number;
};

type Props = {
  value: string | null;
  onChange: (id: string | null, displayName: string | null) => void;
  brandId?: string | null;
  locale: string;
  initialDisplayName?: string | null;
};

export function IndustryPicker({
  value,
  onChange,
  brandId,
  locale,
  initialDisplayName,
}: Props) {
  const t = useTranslations("industryPicker");
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [displayName, setDisplayName] = useState(initialDisplayName ?? "");

  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [waitlistText, setWaitlistText] = useState("");
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false);
  const [waitlistDone, setWaitlistDone] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRu = locale === "ru";

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const { data, error } = await supabase.rpc("search_industries", {
        p_query: query.trim(),
        p_lang: locale,
        p_limit: 5,
      });
      setLoading(false);
      if (error) {
        setResults([]);
        return;
      }
      setResults(data ?? []);
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, locale, supabase]);

  const handlePick = (result: SearchResult, index: number) => {
    const display = isRu ? result.name_ru : result.name_en;
    setDisplayName(display);
    onChange(result.id, display);
    setOpen(false);
    setQuery("");
    // Fire-and-forget instrumentation
    void supabase.rpc("log_industry_search_miss", {
      p_brand_id: brandId ?? undefined,
      p_query_text: query.trim(),
      p_top_5_ids: results.map((r) => r.id),
      p_picked_index: index,
      p_clicked_other: false,
    });
  };

  const handleClickOther = () => {
    // Fire-and-forget instrumentation
    void supabase.rpc("log_industry_search_miss", {
      p_brand_id: brandId ?? undefined,
      p_query_text: query.trim(),
      p_top_5_ids: results.map((r) => r.id),
      p_clicked_other: true,
    });
    setWaitlistText(query.trim());
    setOpen(false);
    setWaitlistOpen(true);
  };

  const submitWaitlist = async () => {
    if (!waitlistText.trim()) return;
    setWaitlistSubmitting(true);
    const { error } = await supabase.rpc("submit_industry_request", {
      p_brand_id: brandId ?? undefined,
      p_query_text: waitlistText.trim(),
      p_email: waitlistEmail.trim() || undefined,
    });
    setWaitlistSubmitting(false);
    if (!error) {
      setWaitlistDone(true);
      setTimeout(() => {
        setWaitlistOpen(false);
        setWaitlistDone(false);
        setWaitlistText("");
        setWaitlistEmail("");
      }, 1500);
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className={displayName ? "" : "text-muted-foreground"}>
              {displayName || t("placeholder")}
            </span>
            <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-(--radix-popover-trigger-width) p-0"
          align="start"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={t("searchPlaceholder")}
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              {loading && (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
              {!loading && query.trim().length >= 2 && results.length === 0 && (
                <CommandEmpty className="p-3">
                  <p className="text-sm text-muted-foreground mb-3">
                    {t("noResults")}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleClickOther}
                    className="w-full"
                  >
                    {t("clickOther")}
                  </Button>
                </CommandEmpty>
              )}
              {!loading && query.trim().length < 2 && (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {t("typeToSearch")}
                </div>
              )}
              {!loading &&
                results.map((r, i) => (
                  <CommandItem
                    key={r.id}
                    value={r.id}
                    onSelect={() => handlePick(r, i)}
                    className="flex flex-col items-start gap-0.5"
                  >
                    <span>{isRu ? r.name_ru : r.name_en}</span>
                    <span className="text-xs text-muted-foreground">
                      {r.industry_group}
                    </span>
                  </CommandItem>
                ))}
              {!loading && results.length > 0 && (
                <div className="border-t mt-1 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleClickOther}
                    className="w-full justify-start text-muted-foreground"
                  >
                    {t("clickOtherShort")}
                  </Button>
                </div>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={waitlistOpen} onOpenChange={setWaitlistOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("waitlistTitle")}</DialogTitle>
          </DialogHeader>
          {waitlistDone ? (
            <div className="py-6 text-center text-sm">{t("waitlistThanks")}</div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t("waitlistDescription")}
              </p>
              <Textarea
                placeholder={t("waitlistTextPlaceholder")}
                value={waitlistText}
                onChange={(e) => setWaitlistText(e.target.value)}
                rows={2}
                maxLength={200}
              />
              <Input
                type="email"
                placeholder={t("waitlistEmailPlaceholder")}
                value={waitlistEmail}
                onChange={(e) => setWaitlistEmail(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setWaitlistOpen(false)}
                  disabled={waitlistSubmitting}
                >
                  {t("waitlistCancel")}
                </Button>
                <Button
                  type="button"
                  onClick={submitWaitlist}
                  disabled={waitlistSubmitting || !waitlistText.trim()}
                >
                  {waitlistSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    t("waitlistSubmit")
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Hidden input для совместимости с native form submission, если нужно */}
      <input type="hidden" name="industry_category_id" value={value ?? ""} />
    </>
  );
}
