"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { useLocale, useT } from "@/i18n/client";
import { LOCALES, LOCALE_COOKIE, isLocale } from "@/i18n/config";
import { cn } from "@/lib/utils";

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Interface language. The choice lives in a cookie so the server renders the
 * next page in it; a refresh re-renders this one without losing view state.
 */
export function LanguagePicker({ className }: { className?: string }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  return (
    <Select
      items={LOCALES.map((l) => ({ value: l.code, label: l.name }))}
      value={locale}
      onValueChange={(next) => {
        if (!isLocale(next) || next === locale) return;
        document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
        document.documentElement.lang = next;
        startTransition(() => router.refresh());
      }}
    >
      <SelectTrigger
        aria-label={t("language.ariaLabel", { name: current.name })}
        className={cn("text-xs", pending && "opacity-60", className)}
      >
        <Languages className="size-3.5 text-muted-foreground" aria-hidden />
        <span className="hidden sm:inline">{current.name}</span>
      </SelectTrigger>
      <SelectContent align="end" className="w-auto min-w-36">
        <SelectGroup>
          {LOCALES.map((l) => (
            <SelectItem key={l.code} value={l.code} lang={l.code}>
              {l.name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
