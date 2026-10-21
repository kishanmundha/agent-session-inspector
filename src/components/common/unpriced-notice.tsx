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
import { CATALOG, PRICE_SOURCES, sourceOf } from "@/lib/price-sources";
import { DEFAULT_OVERRIDE_PATH } from "@/lib/range-cost";
import { useT } from "@/i18n/client";

/** What usage recorded without a model id is filed under; it has no key to price. */
const UNKNOWN_MODEL = "unknown";

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
  const t = useT();
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<PricingInfo | null>(null);
  const requested = useRef("");

  if (models.length === 0) return null;
  const named = models.filter((m) => m !== UNKNOWN_MODEL);

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

  const code = { c: (chunks: React.ReactNode) => <Code>{chunks}</Code> };
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
          {t.rich(
            "unpriced.notice",
            { m: (chunks) => <span className="font-mono text-foreground">{chunks}</span> },
            { models: models.join(", "), count: models.length },
          )}
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
            {t("unpriced.addPrice", { count: named.length })}
          </Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        {/* Only the body scrolls, so the title and close button stay put. */}
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-xl">
          <div className="space-y-1.5 border-b border-border px-5 pt-5 pb-3">
            <DialogTitle>{t("unpriced.dialogTitle", { count: named.length })}</DialogTitle>
            <DialogDescription>
              {t("unpriced.dialogDescription")}
            </DialogDescription>
          </div>

          <div className="flex min-h-0 shrink! flex-col gap-4 overflow-y-auto px-5 pt-4 pb-5 *:shrink-0">
            <section className="space-y-2">
              <h3 className="text-xs font-medium text-foreground">{t("unpriced.step1")}</h3>
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
                        {t("unpriced.sourcePricing", { source: source.label })}
                        <ExternalLink className="size-3" aria-hidden />
                      </a>
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t("unpriced.allPriceLists")}{" "}
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
                {t("unpriced.useApiPrice")}
              </p>
            </section>

            <section className="space-y-2 border-t border-border pt-3">
              <h3 className="text-xs font-medium text-foreground">{t("unpriced.step2")}</h3>
              <div className="flex items-center gap-1 text-xs leading-relaxed text-muted-foreground">
                <p className="min-w-0 flex-1">
                  {t.rich(
                    "unpriced.createFile",
                    { c: (chunks) => <Code>{chunks}</Code> },
                    { path: overridePath, count: named.length },
                  )}
                </p>
                <CopyButton value={overridePath} label={t("unpriced.copyPath")} />
              </div>
              <div className="relative">
                <pre className="overflow-x-auto rounded-lg border border-border bg-muted/50 p-3 pr-10 font-mono text-[11px] leading-relaxed text-foreground">
                  {template}
                </pre>
                <CopyButton
                  value={template}
                  label={t("unpriced.copyFile")}
                  className="absolute top-1.5 right-1.5"
                />
              </div>
              <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-muted-foreground">
                <li>{t.rich("unpriced.fieldsNote", code)}</li>
                <li>{t.rich("unpriced.freeNote", code)}</li>
                <li>{t.rich("unpriced.priceChangeNote", code)}</li>
              </ul>
            </section>

            <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">{t("unpriced.step3")}</span>{" "}
              {t("unpriced.reloadNote")}
              {named.length < models.length && (
                <>
                  {" "}
                  {t.rich("unpriced.unknownNote", code, { model: UNKNOWN_MODEL })}
                </>
              )}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
