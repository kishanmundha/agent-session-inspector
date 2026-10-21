import { useEffect, useState } from "react";
import { useLocale } from "../client";
import type { Locale } from "../config";
import type { EventDocs } from "./en";

/**
 * The event reference is long and only the event dialog reads it, so each
 * language is its own chunk, fetched the first time the dialog opens.
 */
const LOADERS: Record<Locale, () => Promise<EventDocs>> = {
  en: () => import("./en").then((m) => m.en),
  az: () => import("./az").then((m) => m.az),
  de: () => import("./de").then((m) => m.de),
  es: () => import("./es").then((m) => m.es),
  fr: () => import("./fr").then((m) => m.fr),
  id: () => import("./id").then((m) => m.id),
  ja: () => import("./ja").then((m) => m.ja),
  ko: () => import("./ko").then((m) => m.ko),
  pl: () => import("./pl").then((m) => m.pl),
  "pt-BR": () => import("./pt-BR").then((m) => m.ptBR),
  ru: () => import("./ru").then((m) => m.ru),
  th: () => import("./th").then((m) => m.th),
  tr: () => import("./tr").then((m) => m.tr),
  uk: () => import("./uk").then((m) => m.uk),
  vi: () => import("./vi").then((m) => m.vi),
  "zh-CN": () => import("./zh-CN").then((m) => m.zhCN),
  "zh-TW": () => import("./zh-TW").then((m) => m.zhTW),
};

const loaded = new Map<Locale, EventDocs>();

/** The event reference in the active language, or null while it loads. */
export function useEventDocs(): EventDocs | null {
  const locale = useLocale();
  const [, setReady] = useState<Locale | null>(null);

  useEffect(() => {
    if (loaded.has(locale)) return;
    let live = true;
    LOADERS[locale]()
      // A chunk that fails to load still leaves the dialog readable.
      .catch(() => LOADERS.en())
      .then((docs) => {
        loaded.set(locale, docs);
        if (live) setReady(locale);
      });
    return () => {
      live = false;
    };
  }, [locale]);

  return loaded.get(locale) ?? null;
}

export type { EventDoc, EventDocs, EventSource } from "./en";
