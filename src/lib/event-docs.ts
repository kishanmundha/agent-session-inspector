import type { EventDoc, EventDocs } from "@/i18n/event-docs";
import type { ProviderId } from "@/lib/providers/types";

/**
 * Reads the event reference: what each event type means, which records each
 * agent writes it from, and what the app does to them on the way. The text
 * itself is in src/i18n/event-docs, one file per language. Client-safe, so
 * it never imports an adapter.
 */

/** Describes a property of the event as the app holds it, by dotted path. */
export function describeEventPath(docs: EventDocs, doc: EventDoc, path: string): string | undefined {
  const paths: Record<string, string> = docs.pathDocs;
  if (paths[path]) return paths[path];
  const field = /^data\.([^.[\]]+)$/.exec(path)?.[1];
  const fields: Record<string, string> = docs.fieldDocs;
  return field ? doc.fields?.[field] ?? fields[field] : undefined;
}

/** Describes a property of an agent's raw record, by dotted path. */
export function describeRecordPath(docs: EventDocs, provider: ProviderId, path: string): string | undefined {
  const records: Partial<Record<ProviderId, Record<string, string>>> = docs.recordDocs;
  return records[provider]?.[path];
}

/** The doc for a type; types with no entry still get a readable one. */
export function eventDoc(docs: EventDocs, type: string): EventDoc {
  const known = (docs.events as Record<string, EventDoc>)[type];
  if (known) return known;
  const [category, ...rest] = type.split(".");
  return {
    summary: docs.unknownSummary
      .replace("{category}", category || docs.unknownCategory)
      .replace("{name}", rest.join(".") || docs.unknownName),
    detail: docs.unknownDetail,
  };
}

/**
 * The version an agent stamped on a raw record, in the agent's own terms.
 * `label` is the product, or null for Copilot's event format version.
 * Returns null when this record names none.
 */
export function recordVersion(
  provider: ProviderId,
  record: unknown,
): { label: string | null; value: string }[] | null {
  if (!record || typeof record !== "object") return null;
  const rec = record as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : null);
  const found: { label: string | null; value: string }[] = [];
  switch (provider) {
    case "claude":
    case "cowork": {
      const v = str(rec.version);
      if (v) found.push({ label: "Claude Code", value: v });
      break;
    }
    case "codex": {
      const v = str((rec.payload as Record<string, unknown> | undefined)?.cli_version);
      if (v) found.push({ label: "Codex CLI", value: v });
      break;
    }
    case "copilot": {
      const data = (rec.data as Record<string, unknown> | undefined) ?? {};
      const cli = str(data.copilotVersion);
      const format = str(data.version);
      if (cli) found.push({ label: "Copilot CLI", value: cli });
      if (format) found.push({ label: null, value: format });
      break;
    }
  }
  return found.length > 0 ? found : null;
}
