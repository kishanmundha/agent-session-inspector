/**
 * A JSON Schema (draft 2020-12) inferred from example values. Used to show
 * the shape of an event and of the record it came from, without its content.
 */
export interface JsonSchema {
  type?: string | string[];
  description?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  prefixItems?: JsonSchema[];
  [key: string]: unknown;
}

/** Deeper levels are summarized as a bare object; tool inputs nest freely. */
const MAX_DEPTH = 5;
/** Array items looked at to collect the properties of differently shaped items. */
const MAX_ITEMS = 50;

function typeOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
  return typeof value;
}

/** Two shapes of the same property, as one: properties unite, types become a list. */
function merge(a: JsonSchema, b: JsonSchema): JsonSchema {
  if (a.type === b.type) {
    const merged: JsonSchema = { ...a };
    if (a.properties || b.properties) {
      merged.properties = { ...a.properties };
      for (const [key, schema] of Object.entries(b.properties ?? {})) {
        merged.properties[key] = merged.properties[key] ? merge(merged.properties[key], schema) : schema;
      }
    }
    if (a.items && b.items) merged.items = merge(a.items, b.items);
    else if (b.items) merged.items = b.items;
    return merged;
  }
  const types = [...new Set([a.type, b.type].flat().filter((t): t is string => !!t))];
  return { ...a, ...b, type: types, properties: undefined, items: undefined };
}

/**
 * Infers the schema of `value`. `describe` names a property by its dotted
 * path, with `[]` for array items: `message.content[].type`.
 */
export function inferSchema(
  value: unknown,
  describe: (path: string) => string | undefined = () => undefined,
  path = "",
  depth = 0,
): JsonSchema {
  const type = typeOf(value);
  const schema: JsonSchema = { type };
  const description = path ? describe(path) : undefined;
  if (description) schema.description = description;

  if (Array.isArray(value)) {
    const items = value
      .slice(0, MAX_ITEMS)
      .map((item) => inferSchema(item, describe, `${path}[]`, depth + 1));
    if (items.length > 0) schema.items = items.reduce(merge);
  } else if (type === "object" && depth < MAX_DEPTH) {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length > 0) {
      schema.properties = Object.fromEntries(
        entries.map(([key, v]) => [key, inferSchema(v, describe, path ? `${path}.${key}` : key, depth + 1)]),
      );
    }
  }
  return schema;
}

/** `merge` leaves `undefined` keys behind; JSON.stringify drops them. */
export function formatSchema(schema: JsonSchema): string {
  return JSON.stringify(schema, null, 2);
}
