import { cn } from "@/lib/utils";

export interface BarItem {
  name: string;
  value: number;
}

/**
 * Ranked horizontal bars, sized relative to the largest entry — the quickest
 * read for "which tools/event types dominate this session".
 */
export function BarList({
  items,
  color = "bg-brand",
  max: explicitMax,
  emptyLabel = "None",
  limit,
  format = (value) => value.toLocaleString(),
}: {
  items: BarItem[];
  color?: string;
  max?: number;
  emptyLabel?: string;
  limit?: number;
  format?: (value: number) => string;
}) {
  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground">{emptyLabel}</p>;
  }

  const sorted = [...items].sort((a, b) => b.value - a.value);
  const shown = limit ? sorted.slice(0, limit) : sorted;
  const max = explicitMax ?? sorted[0].value ?? 1;

  return (
    <div className="space-y-1.5">
      {shown.map(({ name, value }) => (
        <div key={name} className="flex items-center gap-2.5 text-xs">
          <div
            className="w-28 shrink-0 truncate font-mono text-muted-foreground sm:w-36"
            title={name}
          >
            {name}
          </div>
          <div className="h-4 flex-1 overflow-hidden rounded-sm bg-muted">
            <div
              className={cn("h-full rounded-sm", color)}
              style={{ width: `${Math.max((value / max) * 100, 2)}%` }}
            />
          </div>
          <div className="w-12 shrink-0 text-right font-medium tabular-nums text-foreground">
            {format(value)}
          </div>
        </div>
      ))}
      {limit && sorted.length > limit && (
        <p className="pt-1 text-xs text-muted-foreground">
          +{sorted.length - limit} more
        </p>
      )}
    </div>
  );
}
