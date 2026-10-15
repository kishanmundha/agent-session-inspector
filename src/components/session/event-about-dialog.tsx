"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { ChevronRight, Info } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { CopyButton } from "@/components/common/copy-button";
import {
  describeEventPath,
  describeRecordPath,
  eventDoc,
  PROVIDER_FORMATS,
  recordVersion,
  SHARED_CHANGES,
} from "@/lib/event-docs";
import { formatSchema, inferSchema, type JsonSchema } from "@/lib/json-schema";
import { PROVIDER_STYLES } from "@/lib/provider-meta";
import type { AgentEvent, ProviderId } from "./types";

/** The transcript records an event was read from, uncapped. */
export async function fetchOriginalRecords(
  provider: string,
  sessionId: string,
  sources: string[],
): Promise<unknown[]> {
  const id = encodeURIComponent(decodeURIComponent(sessionId));
  return Promise.all(
    sources.map(async (source) => {
      const res = await fetch(
        `/api/sessions/${provider}/${id}/record?source=${encodeURIComponent(source)}`,
      );
      if (!res.ok) throw new Error(String(res.status));
      return ((await res.json()) as { record: unknown }).record;
    }),
  );
}

/** "idle" until the first open, then the fetch runs straight away. */
type RecordsState = { status: "idle" | "failed" } | { status: "loaded"; records: unknown[] };

const PRE_CLS =
  "max-h-96 min-w-0 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted p-2.5 font-mono text-[11px] leading-relaxed text-foreground [overflow-wrap:anywhere]";

/** Line-based transcripts number their records from 0; people count from 1. */
function describeSource(provider: string, source: string) {
  const jsonl = provider === "claude" || provider === "cowork" || provider === "codex" || provider === "copilot";
  return jsonl && /^\d+$/.test(source) ? `line ${Number(source) + 1}` : source;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 border-t border-border pt-3">
      <h3 className="text-xs font-medium text-foreground">{title}</h3>
      {children}
    </section>
  );
}

const DIALECT = "https://json-schema.org/draft/2020-12/schema";

/** One schema for one value, or a tuple schema when a row stands for several. */
function combine(schemas: JsonSchema[], description: string): JsonSchema {
  const body = schemas.length === 1 ? schemas[0] : { type: "array", description, prefixItems: schemas };
  return { $schema: DIALECT, ...body };
}

/** A schema, collapsed until asked for; the raw values are in the row's Raw panel. */
function SchemaBlock({
  title,
  hint,
  schema,
  placeholder,
}: {
  title: string;
  hint: string;
  schema: string | null;
  /** Shown in place of the schema while it cannot be built. */
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-md border border-border">
      {/* The whole row highlights while the toggle is hovered, but not the copy
          button, which has its own hover. A plain button, because the ghost
          Button keeps its fill while expanded. */}
      <div className="flex items-center gap-1 pr-1.5 transition-colors has-[>button[aria-expanded]:hover]:bg-muted/60">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-left text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50"
        >
          <ChevronRight className={`size-3.5 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} aria-hidden />
          <span className="text-xs font-medium text-foreground">{title}</span>
          <span className="truncate text-[11px] text-muted-foreground">{hint}</span>
        </button>
        {schema && <CopyButton value={schema} label={`Copy the ${title.toLowerCase()}`} />}
      </div>
      {open && (
        <div className="border-t border-border p-2">
          {schema ? (
            <pre className={PRE_CLS}>{schema}</pre>
          ) : (
            <p className="px-0.5 text-xs text-muted-foreground">{placeholder}</p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Explains an event type: what it means, the record the agent wrote it from,
 * what the app changed, and the shape of the event before and after.
 */
export function EventAboutDialog({
  open,
  onOpenChange,
  event,
  result,
  sources,
  clientVersion,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: AgentEvent;
  /** The completing event, when a call and its result are shown as one row. */
  result?: AgentEvent;
  sources: string[];
  /** The session's client version, for agents that stamp it only once. */
  clientVersion?: string;
}) {
  const params = useParams<{ provider?: string; id?: string }>();
  const provider = (params.provider ?? "") as ProviderId;
  const providerLabel = PROVIDER_STYLES[provider]?.label ?? provider;
  const doc = eventDoc(event.type);
  const resultDoc = result && result.type !== event.type ? eventDoc(result.type) : null;
  const [records, setRecords] = useState<RecordsState>({ status: "idle" });
  const requested = useRef(false);

  // The originals are read once, the first time the dialog opens.
  useEffect(() => {
    if (!open || requested.current || sources.length === 0 || !params.provider || !params.id) return;
    requested.current = true;
    fetchOriginalRecords(params.provider, params.id, sources)
      .then((loaded) => setRecords({ status: "loaded", records: loaded }))
      .catch(() => setRecords({ status: "failed" }));
  }, [open, sources, params.provider, params.id]);

  const providerSources = [
    ...(doc.sources?.[provider] ?? []).map((s) => ({ ...s, type: event.type })),
    ...(resultDoc?.sources?.[provider] ?? []).map((s) => ({ ...s, type: result!.type })),
  ];
  const changes = [...new Set([...(doc.changes ?? []), ...(resultDoc?.changes ?? [])])];

  const recorded =
    records.status === "loaded"
      ? records.records.map((r) => recordVersion(provider, r)).find((v) => v !== null) ?? null
      : null;

  // Both schemas are inferred from this event and its records, so they show
  // the fields this agent actually wrote, with no content.
  const shown = result ? [event, result] : [event];
  const eventSchema = formatSchema(
    combine(
      shown.map((e) => {
        const d = eventDoc(e.type);
        return { title: e.type, description: d.summary, ...inferSchema(e, (p) => describeEventPath(d, p)) };
      }),
      "A call and its result, shown as one row.",
    ),
  );
  const recordSchema =
    records.status === "loaded"
      ? formatSchema(
          combine(
            records.records.map((r) => ({
              title: `${providerLabel} record`,
              ...inferSchema(r, (p) => describeRecordPath(provider, p)),
            })),
            "The records the row was read from, in transcript order.",
          ),
        )
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Only the body scrolls, so the title and close button stay put. */}
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <div className="flex items-center gap-3 border-b border-border px-5 pt-5 pb-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Info className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <DialogTitle className="truncate font-mono text-sm">
              {resultDoc ? `${event.type} + ${result!.type}` : event.type}
            </DialogTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">About this event type</p>
          </div>
        </div>

        <div className="flex min-h-0 shrink! flex-col gap-4 overflow-y-auto px-5 pt-4 pb-5">
          <div className="space-y-1.5">
            <DialogDescription className="text-sm text-foreground">{doc.summary}</DialogDescription>
            {resultDoc && <p className="text-sm text-foreground">{resultDoc.summary}</p>}
            {doc.detail && <p className="text-xs leading-relaxed text-muted-foreground">{doc.detail}</p>}
          </div>

          <Section title={`Where it comes from · ${providerLabel}`}>
            {PROVIDER_FORMATS[provider] && (
              <p className="text-xs leading-relaxed text-muted-foreground">{PROVIDER_FORMATS[provider]}</p>
            )}
            {providerSources.length > 0 ? (
              <ul className="space-y-1.5 text-xs">
                {providerSources.map((s) => (
                  <li key={`${s.type}:${s.record}`} className="rounded-md border border-border px-2.5 py-1.5">
                    <p className="text-foreground">
                      {s.record}
                      {resultDoc && <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">→ {s.type}</span>}
                    </p>
                    {s.note && <p className="mt-0.5 leading-relaxed text-muted-foreground">{s.note}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                The record this type is read from is not described for {providerLabel} yet. Compare the two
                schemas below to see how it maps.
              </p>
            )}
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              <dt className="text-muted-foreground">This event</dt>
              <dd className="font-mono text-foreground">
                {sources.length > 0
                  ? sources.map((s) => describeSource(provider, s)).join(", ")
                  : "no original record to look up"}
              </dd>
              <dt className="text-muted-foreground">Recorded by</dt>
              <dd className="text-foreground">
                {recorded ? (
                  recorded.map((v) => (
                    <span key={v.label} className="mr-3 inline-block">
                      {v.label} <span className="font-mono">{v.value}</span>
                    </span>
                  ))
                ) : records.status === "idle" && sources.length > 0 ? (
                  <span className="text-muted-foreground">Reading the record…</span>
                ) : clientVersion ? (
                  <>
                    <span className="font-mono">{clientVersion}</span>
                    <span className="text-muted-foreground"> · from the session; this record names no version</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">No version recorded</span>
                )}
              </dd>
            </dl>
          </Section>

          <Section title="What the app changes">
            <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-muted-foreground marker:text-border">
              {changes.map((c) => (
                <li key={c} className="text-foreground">{c}</li>
              ))}
              {SHARED_CHANGES.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </Section>

          <Section title="Format">
            <p className="text-xs leading-relaxed text-muted-foreground">
              JSON Schema of this event and of the record it was read from: each property with its
              type and meaning, without the values. Raw on the row shows the values.
            </p>
            <SchemaBlock
              title="Transformed schema"
              hint="the event as this app holds it"
              schema={eventSchema}
              placeholder=""
            />
            <SchemaBlock
              title="Original schema"
              hint={`the record as ${providerLabel} wrote it`}
              schema={recordSchema}
              placeholder={
                sources.length === 0
                  ? "This event was built by the app, or the agent's records cannot be looked up one by one."
                  : records.status === "failed"
                    ? "Could not read the record."
                    : "Reading the record…"
              }
            />
          </Section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
