/**
 * The interface languages. `name` is how the language calls itself, which is
 * what the picker shows whatever language is active.
 */
export const LOCALES = [
  { code: "en", name: "English" },
  { code: "az", name: "Azərbaycan" },
  { code: "de", name: "Deutsch" },
  { code: "es", name: "Español" },
  { code: "fr", name: "Français" },
  { code: "id", name: "Bahasa Indonesia" },
  { code: "ja", name: "日本語" },
  { code: "ko", name: "한국어" },
  { code: "pl", name: "Polski" },
  { code: "pt-BR", name: "Português (Brasil)" },
  { code: "ru", name: "Русский" },
  { code: "th", name: "ไทย" },
  { code: "tr", name: "Türkçe" },
  { code: "uk", name: "Українська" },
  { code: "vi", name: "Tiếng Việt" },
  { code: "zh-CN", name: "简体中文" },
  { code: "zh-TW", name: "繁體中文" },
] as const;

export type Locale = (typeof LOCALES)[number]["code"];

export const DEFAULT_LOCALE: Locale = "en";

/** Set by the language picker; read by the root layout on every request. */
export const LOCALE_COOKIE = "asv-locale";

export function isLocale(value: unknown): value is Locale {
  return LOCALES.some((l) => l.code === value);
}

/** Chinese written in Traditional characters, by script or by region. */
const TRADITIONAL = /^zh-(hant|tw|hk|mo)\b/i;

/** Maps one BCP 47 tag ("fr-CA", "zh-Hant-TW") to a supported locale. */
function matchTag(tag: string): Locale | undefined {
  const lower = tag.trim().toLowerCase();
  if (!lower || lower === "*") return undefined;
  if (lower.startsWith("zh")) return TRADITIONAL.test(lower) ? "zh-TW" : "zh-CN";
  const base = lower.split("-")[0];
  // Brazilian Portuguese is the only Portuguese offered, so pt-PT gets it too.
  if (base === "pt") return "pt-BR";
  return LOCALES.find((l) => l.code === base)?.code;
}

/**
 * The best supported locale for an Accept-Language header, honouring its
 * q-weights; English when nothing matches.
 */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const ranked = acceptLanguage
    .split(",")
    .map((part, i) => {
      const [tag, ...params] = part.split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { tag, q: q ? Number(q.slice(2)) || 0 : 1, i };
    })
    .filter((entry) => entry.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i);
  for (const { tag } of ranked) {
    const match = matchTag(tag);
    if (match) return match;
  }
  return DEFAULT_LOCALE;
}
