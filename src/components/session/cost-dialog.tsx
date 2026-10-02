"use client";

import { Fragment, useState } from "react";
import { ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CopyButton } from "@/components/common/copy-button";
import { formatCost } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CostLine, CostSummary } from "./types";

const CLASS_LABEL: Record<CostLine["kind"], string> = {
  input: "Uncached input",
  cacheWrite: "Cache write",
  cacheWrite1h: "Cache write (1h)",
  cacheRead: "Cache read",
  output: "Output",
};

const GLOSSARY: [string, string][] = [
  ["Uncached input", "new prompt text the model had not seen before."],
  [
    "Cache write",
    "context stored so later requests can reuse it. A 1-hour cache costs more to write than the default.",
  ],
  [
    "Cache read",
    "stored context reused at a discount. The whole conversation is re-sent on every request, so this grows fastest in long sessions.",
  ],
  ["Output", "the model's replies, tool calls and reasoning."],
];

/** Rates keep enough decimals to show sub-cent prices such as $0.075. */
function formatRate(rate: number) {
  return `$${rate.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })}`;
}

/**
 * A pricing.json the user can paste as-is: this session's models at the rates
 * currently applied, with a zeroed entry to fill in for any without a price.
 */
function overrideTemplate(prices: CostSummary["prices"]) {
  const models = Object.entries(prices).map(([model, entries]) => {
    const rows = (entries ?? [{ input: 0, output: 0 }])
      .map((entry) => `    ${JSON.stringify(entry).replace(/([{,:])/g, "$1 ").replace("}", " }")}`)
      .join(",\n");
    return `  ${JSON.stringify(model)}: [\n${rows}\n  ]`;
  });
  return `{\n${models.join(",\n")}\n}`;
}

/** The arithmetic behind a session's estimated cost, one row per rate paid. */
export function CostDialog({
  cost,
  open,
  onOpenChange,
}: {
  cost: CostSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const multiModel = cost.byModel.length > 1;
  const partial = cost.unpricedModels.length > 0;
  const template = overrideTemplate(cost.prices);
  // Starts open when a price is missing: that is when it is needed.
  const [pricesOpen, setPricesOpen] = useState(partial);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <div className="space-y-1.5">
          <DialogTitle>How this cost is estimated</DialogTitle>
          <DialogDescription>
            This is what the session&rsquo;s tokens would cost on the
            pay-per-token API at list prices. It is not a bill: on a
            subscription or a request-based plan you pay your plan price, however
            many tokens a session uses.
          </DialogDescription>
        </div>

        <div className="overflow-hidden rounded-lg border border-border">
          <Table className="text-xs">
            <TableHeader>
              <TableRow className="bg-muted/60 hover:bg-muted/60">
                <TableHead className="h-8 px-3 text-muted-foreground">Token type</TableHead>
                <TableHead className="h-8 px-3 text-right text-muted-foreground">Tokens</TableHead>
                <TableHead className="h-8 px-3 text-right text-muted-foreground">
                  Rate / 1M
                </TableHead>
                <TableHead className="h-8 px-3 text-right text-muted-foreground">Cost</TableHead>
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
                      {model.model}
                    </TableHead>
                    <TableCell className="px-3 py-1.5 text-right font-mono font-semibold text-foreground">
                      {multiModel && model.costUSD !== null && formatCost(model.costUSD)}
                    </TableCell>
                  </TableRow>
                  {cost.lines
                    .filter((line) => line.model === model.model)
                    .map((line) => (
                      <TableRow key={`${line.kind}-${line.rate}`} className="border-border/60">
                        <TableCell className="px-3 py-1.5 text-foreground">
                          {CLASS_LABEL[line.kind]}
                        </TableCell>
                        <TableCell className="px-3 py-1.5 text-right font-mono">
                          {line.tokens.toLocaleString()}
                        </TableCell>
                        <TableCell className="px-3 py-1.5 text-right font-mono">
                          {line.rate === null ? "—" : formatRate(line.rate)}
                        </TableCell>
                        <TableCell className="px-3 py-1.5 text-right font-mono text-foreground">
                          {line.usd === null ? (
                            <span className="font-sans text-muted-foreground">
                              no price
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
                <TableHead colSpan={3} scope="row" className="h-auto px-3 py-2 font-semibold">
                  Total
                </TableHead>
                <TableCell className="px-3 py-2 text-right font-mono font-bold tabular-nums text-foreground">
                  {formatCost(cost.totalUSD)}
                  {partial && "+"}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>

        <p className="text-xs text-muted-foreground">
          Each row is tokens ÷ 1,000,000 × rate, using the list price on the day
          of the request.
          {partial && (
            <>
              {" "}
              No price is known for {cost.unpricedModels.join(", ")}, so the
              total leaves {cost.unpricedModels.length > 1 ? "them" : "it"} out.
            </>
          )}
        </p>

        <dl className="space-y-1.5 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
          {GLOSSARY.map(([term, meaning]) => (
            <div key={term}>
              <dt className="inline font-medium text-foreground">{term}: </dt>
              <dd className="inline">{meaning}</dd>
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
                "size-3.5 shrink-0 text-muted-foreground transition-transform",
                pricesOpen && "rotate-90",
              )}
              aria-hidden
            />
            {partial ? "Add the missing price" : "Change these prices"}
          </button>
          <div
            id="cost-dialog-prices"
            hidden={!pricesOpen}
            className="space-y-2 border-t border-border px-3 py-3 leading-relaxed text-muted-foreground"
          >
            <p>
              Save the block below as{" "}
              <code className="font-mono text-foreground">{cost.overridePath}</code>{" "}
              and edit the numbers. It replaces the bundled price for the models
              it lists and takes effect on the next page load.
            </p>
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
            <ul className="list-disc space-y-1 pl-4">
              <li>All prices are US dollars per million tokens.</li>
              <li>
                <code className="font-mono text-foreground">input</code> and{" "}
                <code className="font-mono text-foreground">output</code> are
                required. <code className="font-mono text-foreground">cacheRead</code>,{" "}
                <code className="font-mono text-foreground">cacheWrite</code> and{" "}
                <code className="font-mono text-foreground">cacheWrite1h</code>{" "}
                are optional: the first two fall back to the input price,
                and <code className="font-mono text-foreground">cacheWrite1h</code>{" "}
                to <code className="font-mono text-foreground">cacheWrite</code>.{" "}
                <code className="font-mono text-foreground">fast</code> multiplies
                every price for requests made in a faster, premium speed tier.
              </li>
              <li>
                To record a price change, add a second entry with{" "}
                <code className="font-mono text-foreground">
                  &quot;from&quot;: &quot;YYYY-MM-DD&quot;
                </code>
                . Requests before that day keep the old price.
              </li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
