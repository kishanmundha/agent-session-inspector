"use client";

import { useRef, useState } from "react";
import { AlertTriangle, ExternalLink, Info } from "lucide-react";
import { CopyButton } from "@/components/common/copy-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

interface PriceSource {
  label: string;
  url: string;
  /** Model ids this vendor's price list covers. */
  match: RegExp;
}

/** Vendor price lists, all quoted in US dollars per million tokens. */
const PRICE_SOURCES: PriceSource[] = [
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
const CATALOG = { label: "OpenRouter", url: "https://openrouter.ai/models" };

function sourceOf(key: string): { label: string; url: string } {
  return (
    PRICE_SOURCES.find((source) => source.match.test(key)) ?? {
      label: CATALOG.label,
      url: `${CATALOG.url}?q=${encodeURIComponent(key)}`,
    }
  );
}

/** What usage recorded without a model id is filed under; it has no key to price. */
const UNKNOWN_MODEL = "unknown";

const DEFAULT_OVERRIDE_PATH = "~/.agent-session-inspector/pricing.json";

const externalLink = { target: "_blank", rel: "noreferrer" } as const;

interface PricingInfo {
  overridePath: string;
  /** Transcript model id to the key its `pricing.json` entry needs. */
  keys: Record<string, string>;
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-foreground">{children}</code>;
}

/**
 * The note under the stat cards when some models have no price, plus the
 * dialog that explains where to find one and how to add it.
 */
export function UnpricedNotice({ models }: { models: string[] }) {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<PricingInfo | null>(null);
  const requested = useRef("");

  if (models.length === 0) return null;
  const many = models.length > 1;
  const named = models.filter((m) => m !== UNKNOWN_MODEL);
  const manyNamed = named.length > 1;

  function openDialog() {
    setOpen(true);
    const query = named.map((m) => `model=${encodeURIComponent(m)}`).join("&");
    if (requested.current === query) return;
    requested.current = query;
    fetch(`/api/pricing?${query}`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setInfo)
      .catch(() => setInfo(null));
  }

  const overridePath = info?.overridePath ?? DEFAULT_OVERRIDE_PATH;
  const keys = [...new Set(named.map((m) => info?.keys[m] ?? m.toLowerCase()))];
  const template = JSON.stringify(
    Object.fromEntries(keys.map((key) => [key, { input: 0, output: 0, cacheRead: 0 }])),
    null,
    2,
  );

  return (
    <>
      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
        <p className="min-w-0 flex-1">
          No price is known for{" "}
          <span className="font-mono text-foreground">{models.join(", ")}</span>, so cost figures
          leave {many ? "them" : "it"} out. Token counts still include {many ? "them" : "it"}.
        </p>
        {named.length > 0 && (
          <Button
            variant="outline"
            size="xs"
            onClick={openDialog}
            aria-haspopup="dialog"
            className="-my-1 shrink-0"
          >
            <Info aria-hidden />
            Add {manyNamed ? "prices" : "a price"}
          </Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <div className="space-y-1.5">
            <DialogTitle>Add {manyNamed ? "the missing prices" : "the missing price"}</DialogTitle>
            <DialogDescription>
              Costs are estimated from a price table bundled with the app. A model the table does
              not list is left out of every cost figure until you give it a price in your own
              override file. Nothing is fetched: you look the price up and enter it once.
            </DialogDescription>
          </div>

          <section className="space-y-2">
            <h3 className="text-xs font-medium text-foreground">1. Find the price</h3>
            <ul className="overflow-hidden rounded-lg border border-border text-xs">
              {keys.map((key) => {
                const source = sourceOf(key);
                return (
                  <li
                    key={key}
                    className="flex items-center gap-2 border-b border-border/60 px-3 py-2 last:border-b-0"
                  >
                    <span className="min-w-0 flex-1 truncate font-mono text-foreground">{key}</span>
                    <a
                      href={source.url}
                      {...externalLink}
                      className="inline-flex shrink-0 items-center gap-1 rounded-sm font-medium text-foreground underline underline-offset-2 hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      {source.label} pricing
                      <ExternalLink className="size-3" aria-hidden />
                    </a>
                  </li>
                );
              })}
            </ul>
            <p className="text-xs leading-relaxed text-muted-foreground">
              All price lists:{" "}
              {[...PRICE_SOURCES, CATALOG].map((source, i) => (
                <span key={source.label}>
                  {i > 0 && " · "}
                  <a
                    href={source.url}
                    {...externalLink}
                    className="text-foreground underline underline-offset-2 hover:text-brand"
                  >
                    {source.label}
                  </a>
                </span>
              ))}
              . Use the pay-per-token API price in US dollars per million tokens.
            </p>
          </section>

          <section className="space-y-2 border-t border-border pt-3">
            <h3 className="text-xs font-medium text-foreground">2. Add it to pricing.json</h3>
            <div className="flex items-center gap-1 text-xs leading-relaxed text-muted-foreground">
              <p className="min-w-0 flex-1">
                Create <Code>{overridePath}</Code> if it does not exist, or add{" "}
                {manyNamed ? "these entries" : "this entry"} to the one you have, and replace the zeros.
              </p>
              <CopyButton value={overridePath} label="Copy path" />
            </div>
            <div className="relative">
              <pre className="overflow-x-auto rounded-lg border border-border bg-muted/50 p-3 pr-10 font-mono text-[11px] leading-relaxed text-foreground">
                {template}
              </pre>
              <CopyButton
                value={template}
                label="Copy pricing.json"
                className="absolute top-1.5 right-1.5"
              />
            </div>
            <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-muted-foreground">
              <li>
                <Code>input</Code> and <Code>output</Code> are required. <Code>cacheRead</Code>,{" "}
                <Code>cacheWrite</Code> and <Code>cacheWrite1h</Code> are optional: the first two
                fall back to the input price, and <Code>cacheWrite1h</Code> to{" "}
                <Code>cacheWrite</Code>.
              </li>
              <li>
                A model you run yourself costs nothing per token: leave <Code>input</Code> and{" "}
                <Code>output</Code> at 0 to count it as free.
              </li>
              <li>
                To record a price change, give the model a list of entries and mark the later one
                with <Code>&quot;from&quot;: &quot;YYYY-MM-DD&quot;</Code>. Older sessions keep
                the old price.
              </li>
            </ul>
          </section>

          <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">3. Reload this page.</span> The file is
            read on every load, so no restart is needed. Entries in it also replace the bundled
            price of any model they name.
            {named.length < models.length && (
              <>
                {" "}
                Usage listed as <Code>{UNKNOWN_MODEL}</Code> was recorded without a model name, so
                it cannot be given a price.
              </>
            )}
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
