'use client';

import { Fragment, useState } from 'react';
import { ChevronRight, ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CopyButton } from '@/components/common/copy-button';
import { formatCost, formatNumber } from '@/lib/format';
import { formatLocale } from '@/i18n/current';
import { useT } from '@/i18n/client';
import { sourceOf } from '@/lib/price-sources';
import { cn } from '@/lib/utils';
import type { CostLine, CostSummary } from './types';

/** Token classes in receipt order; labelled by `cost.classes.*`. */
export const COST_KINDS: CostLine['kind'][] = [
  'input',
  'cacheWrite',
  'cacheWrite1h',
  'cacheRead',
  'output',
];

/** Classes the glossary explains; the 1-hour write is covered by the plain one. */
const GLOSSARY = ['input', 'cacheWrite', 'cacheRead', 'output'] as const;

const externalLink = { target: '_blank', rel: 'noreferrer' } as const;

/** The model name, linked to its vendor's price list when one is known. */
function ModelPriceLink({
  model,
  priceKey,
}: {
  model: string;
  priceKey?: string;
}) {
  const t = useT();
  if (!priceKey) return <>{model}</>;
  const source = sourceOf(priceKey);
  return (
    <a
      href={source.url}
      {...externalLink}
      title={t('cost.checkRates', { source: source.label })}
      className="inline-flex items-center gap-1 rounded-sm underline decoration-muted-foreground/50 underline-offset-2 hover:text-brand hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {model}
      <ExternalLink className="size-3 text-muted-foreground" aria-hidden />
      <span className="sr-only">
        {t('cost.opensInTab', { source: source.label })}
      </span>
    </a>
  );
}

/** Marks a model whose rates come from the user's pricing.json. */
function CustomPriceBadge({ path }: { path: string }) {
  const t = useT();
  return (
    <span
      title={t('cost.pricedFrom', { path })}
      className="ml-2 rounded-sm border border-amber-500/40 bg-amber-500/10 px-1.5 py-px font-sans text-[10px] font-medium uppercase tracking-wider text-amber-700 dark:text-amber-400"
    >
      {t('cost.yourPrice')}
    </span>
  );
}

/** Rates keep enough decimals to show sub-cent prices such as $0.075. */
export function formatRate(rate: number) {
  return rate.toLocaleString(formatLocale(), {
    style: 'currency',
    currency: 'USD',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

/**
 * A pricing.json the user can paste as-is: this session's models at the rates
 * currently applied, with a zeroed entry to fill in for any without a price.
 */
function overrideTemplate(prices: CostSummary['prices']) {
  const models = Object.entries(prices).map(([model, entries]) => {
    const rows = (entries ?? [{ input: 0, output: 0 }])
      .map((entry) => {
        const fields = Object.entries(entry).map(
          ([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value)}`,
        );
        return `    { ${fields.join(', ')} }`;
      })
      .join(',\n');
    return `  ${JSON.stringify(model)}: [\n${rows}\n  ]`;
  });
  return `{\n${models.join(',\n')}\n}`;
}

/** One receipt: a row per rate paid, grouped by model, with its total. */
function CostTable({
  cost,
  totalLabel,
}: {
  cost: CostSummary;
  totalLabel: string;
}) {
  const t = useT();
  const multiModel = cost.byModel.length > 1;
  const partial = cost.unpricedModels.length > 0;
  const custom = new Set(cost.customPriced ?? []);
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table className="text-xs">
        <TableHeader>
          <TableRow className="bg-muted/60 hover:bg-muted/60">
            <TableHead className="h-8 px-3 text-muted-foreground">
              {t('cost.tokenType')}
            </TableHead>
            <TableHead className="h-8 px-3 text-right text-muted-foreground">
              {t('usage.units.tokens')}
            </TableHead>
            <TableHead className="h-8 px-3 text-right text-muted-foreground">
              {t('cost.ratePerMillion')}
            </TableHead>
            <TableHead className="h-8 px-3 text-right text-muted-foreground">
              {t('usage.units.costUSD')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="tabular-nums">
          {cost.byModel.map((model) => (
            <Fragment key={model.model}>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead
                  colSpan={3}
                  scope="rowgroup"
                  className="h-auto px-3 py-1.5 font-mono font-semibold"
                >
                  <ModelPriceLink
                    model={model.model}
                    priceKey={cost.priceKeys?.[model.model]}
                  />
                  {custom.has(model.model) && (
                    <CustomPriceBadge path={cost.overridePath} />
                  )}
                </TableHead>
                <TableCell className="px-3 py-1.5 text-right font-mono font-semibold text-foreground">
                  {multiModel &&
                    model.costUSD !== null &&
                    formatCost(model.costUSD)}
                </TableCell>
              </TableRow>
              {cost.lines
                .filter((line) => line.model === model.model)
                .map((line) => (
                  <TableRow
                    key={`${line.kind}-${line.rate}`}
                    className="border-border/60"
                  >
                    <TableCell className="px-3 py-1.5 text-foreground">
                      {t(`cost.classes.${line.kind}`)}
                    </TableCell>
                    <TableCell className="px-3 py-1.5 text-right font-mono">
                      {formatNumber(line.tokens)}
                    </TableCell>
                    <TableCell className="px-3 py-1.5 text-right font-mono">
                      {line.rate === null ? '—' : formatRate(line.rate)}
                    </TableCell>
                    <TableCell className="px-3 py-1.5 text-right font-mono text-foreground">
                      {line.usd === null ? (
                        <span className="font-sans text-muted-foreground">
                          {t('cost.noPrice')}
                        </span>
                      ) : (
                        formatCost(line.usd)
                      )}
                    </TableCell>
                  </TableRow>
                ))}
            </Fragment>
          ))}
        </TableBody>
        <TableFooter className="bg-muted/60">
          <TableRow className="hover:bg-transparent">
            <TableHead
              colSpan={3}
              scope="row"
              className="h-auto px-3 py-2 font-semibold"
            >
              {totalLabel}
            </TableHead>
            <TableCell className="px-3 py-2 text-right font-mono font-bold tabular-nums text-foreground">
              {formatCost(cost.totalUSD)}
              {partial && '+'}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}

/** The arithmetic behind a session's estimated cost, one row per rate paid. */
export function CostDialog({
  cost,
  open,
  onOpenChange,
  scope,
}: {
  cost: CostSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Set when the cost covers many sessions, e.g. a dashboard's range, not one session. */
  scope?: { sessions: number; period: string };
}) {
  const t = useT();
  const partial = cost.unpricedModels.length > 0;
  // Empty only while a dashboard's receipt is still fetching its entries.
  const template =
    Object.keys(cost.prices).length > 0 ? overrideTemplate(cost.prices) : null;
  const customPriced = cost.customPriced ?? [];
  const code = {
    c: (chunks: React.ReactNode) => (
      <code className="font-mono text-foreground">{chunks}</code>
    ),
  };
  // Starts open when a price is missing: that is when it is needed.
  const [pricesOpen, setPricesOpen] = useState(partial);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Only the body scrolls, so the title and close button stay put. */}
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-xl">
        <div className="space-y-1.5 border-b border-border px-5 pt-5 pb-3">
          <DialogTitle>{t('cost.title')}</DialogTitle>
          <DialogDescription>
            {scope
              ? t('cost.introRange', { count: scope.sessions, period: scope.period })
              : t('cost.introSession')}{' '}
            {t('cost.notABill')}
          </DialogDescription>
        </div>

        <div className="flex min-h-0 shrink! flex-col gap-4 overflow-y-auto px-5 pt-4 pb-5 *:shrink-0">
          <CostTable
            cost={cost}
            totalLabel={cost.inherited ? t('cost.thisSession') : t('cost.total')}
          />

          <p className="text-xs text-muted-foreground">
            {t('cost.rowFormula')}
            {partial && (
              <>
                {' '}
                {t('cost.unpriced', {
                  models: cost.unpricedModels.join(', '),
                  count: cost.unpricedModels.length,
                })}
              </>
            )}
          </p>

          {customPriced.length > 0 && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">
                {t('cost.customInUse')}
              </span>{' '}
              {t.rich(
                'cost.customDetail',
                {
                  c: (chunks) => (
                    <code className="font-mono text-foreground">{chunks}</code>
                  ),
                  m: (chunks) => (
                    <span className="font-mono text-foreground">{chunks}</span>
                  ),
                },
                { path: cost.overridePath, models: customPriced.join(', ') },
              )}
            </p>
          )}

          {cost.inherited && (
            <div className="space-y-2 border-t border-border pt-3">
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-foreground">
                  {t('cost.inheritedTitle')}
                </h3>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t('cost.inheritedDetail')}
                </p>
              </div>
              <CostTable cost={cost.inherited} totalLabel={t('cost.inherited')} />
            </div>
          )}

          <dl className="space-y-1.5 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
            {GLOSSARY.map((kind) => (
              <div key={kind}>
                <dt className="inline font-medium text-foreground">
                  {t('cost.glossaryTerm', { term: t(`cost.classes.${kind}`) })}{' '}
                </dt>
                <dd className="inline">{t(`cost.glossary.${kind}`)}</dd>
              </div>
            ))}
          </dl>

          {/* Same disclosure pattern as a timeline event row. */}
          <div className="overflow-hidden rounded-lg border border-border bg-card text-xs">
            <button
              type="button"
              onClick={() => setPricesOpen(!pricesOpen)}
              aria-expanded={pricesOpen}
              aria-controls="cost-dialog-prices"
              className="flex w-full items-center gap-2 px-3 py-2 text-left font-medium text-foreground transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
            >
              <ChevronRight
                className={cn(
                  'size-3.5 shrink-0 text-muted-foreground transition-transform',
                  pricesOpen && 'rotate-90',
                )}
                aria-hidden
              />
              {partial ? t('unpriced.dialogTitle', { count: 1 }) : t('cost.changePrices')}
            </button>
            <div
              id="cost-dialog-prices"
              hidden={!pricesOpen}
              className="space-y-2 border-t border-border px-3 py-3 leading-relaxed text-muted-foreground"
            >
              {template ? (
                <>
                  <p>
                    {t.rich('cost.saveAs', code, { path: cost.overridePath })}
                  </p>
                  <div className="relative">
                    <pre className="overflow-x-auto rounded-lg border border-border bg-muted/50 p-3 pr-10 font-mono text-[11px] leading-relaxed text-foreground">
                      {template}
                    </pre>
                    <CopyButton
                      value={template}
                      label={t('unpriced.copyFile')}
                      className="absolute top-1.5 right-1.5"
                    />
                  </div>
                </>
              ) : (
                <p>{t('cost.loadingPrices')}</p>
              )}
              <ul className="list-disc space-y-1 pl-4">
                <li>{t('cost.usdPerMillion')}</li>
                <li>
                  {t.rich('unpriced.fieldsNote', code)}{' '}
                  {t.rich('cost.fastNote', code)}
                </li>
                <li>{t.rich('cost.priceChangeNote', code)}</li>
              </ul>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
