import { cn } from "@/lib/utils";

/** Titled card that holds one chart or table on a dashboard. */
export function Panel({
  title,
  note,
  action,
  className,
  children,
}: {
  title: string;
  note?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("min-w-0 rounded-xl border border-border bg-card p-4", className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">
          {title}
          {note && <span className="ml-2 text-xs font-normal text-muted-foreground">{note}</span>}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
