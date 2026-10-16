export interface PriceSource {
  label: string;
  url: string;
  /** Model ids this vendor's price list covers. */
  match: RegExp;
}

/** Vendor price lists, all quoted in US dollars per million tokens. */
export const PRICE_SOURCES: PriceSource[] = [
  {
    label: "Anthropic",
    url: "https://platform.claude.com/docs/en/about-claude/pricing",
    match: /^claude/,
  },
  {
    label: "OpenAI",
    url: "https://platform.openai.com/docs/pricing",
    match: /^(gpt|chatgpt|codex|o\d)/,
  },
  {
    label: "Google Gemini",
    url: "https://ai.google.dev/gemini-api/docs/pricing",
    match: /^gemini/,
  },
  { label: "xAI", url: "https://docs.x.ai/docs/models", match: /^grok/ },
  {
    label: "Mistral",
    url: "https://mistral.ai/pricing",
    match: /^(mistral|codestral|devstral|magistral|ministral|pixtral)/,
  },
  {
    label: "DeepSeek",
    url: "https://api-docs.deepseek.com/quick_start/pricing",
    match: /^deepseek/,
  },
];

/** Lists most models of most vendors, for the ones without a list above. */
export const CATALOG = { label: "OpenRouter", url: "https://openrouter.ai/models" };

/** The price list to check a model against, by its price-table key. */
export function sourceOf(key: string): { label: string; url: string } {
  return (
    PRICE_SOURCES.find((source) => source.match.test(key)) ?? {
      label: CATALOG.label,
      url: `${CATALOG.url}?q=${encodeURIComponent(key)}`,
    }
  );
}
