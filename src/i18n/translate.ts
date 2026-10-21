import type { Locale } from "./config";

/**
 * A message that depends on a count, keyed by the CLDR plural category
 * (`Intl.PluralRules`). `other` is required; a language uses only the
 * categories it has (Japanese needs `other` alone, English `one` and `other`).
 */
export interface Plural {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}

export type Message = string | Plural;

export interface MessageTree {
  [key: string]: Message | MessageTree;
}

/** Values substituted for `{name}` placeholders; numbers are formatted for the locale. */
export type MessageValues = Record<string, string | number>;

const CATEGORIES = new Set(["zero", "one", "two", "few", "many", "other"]);

/**
 * A plural is an object whose keys are all plural categories, so a group of
 * messages may still have one called "other".
 */
const isPlural = (node: Message | MessageTree): node is Plural =>
  typeof node === "object" &&
  typeof node.other === "string" &&
  Object.keys(node).every((key) => CATEGORIES.has(key));

type IsPlural<T> = T extends object ? (keyof T extends keyof Plural ? true : false) : false;

/** Dotted paths to every message in a tree: "home.tabs.analytics". */
export type MessageKey<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : IsPlural<T[K]> extends true
      ? `${Prefix}${K}`
      : MessageKey<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

/** The shape of a message tree with every literal widened to string. */
export type Widen<T> = {
  -readonly [K in keyof T]: T[K] extends string
    ? string
    : IsPlural<T[K]> extends true
      ? Plural
      : Widen<T[K]>;
};

export function lookup(tree: MessageTree, key: string): Message | undefined {
  let node: Message | MessageTree | undefined = tree;
  for (const part of key.split(".")) {
    if (node === undefined || typeof node === "string" || isPlural(node)) return undefined;
    node = node[part];
  }
  if (node === undefined || typeof node === "string" || isPlural(node)) return node;
  return undefined;
}

const pluralRules = new Map<string, Intl.PluralRules>();
const numberFormats = new Map<string, Intl.NumberFormat>();

function rulesFor(locale: Locale) {
  let rules = pluralRules.get(locale);
  if (!rules) pluralRules.set(locale, (rules = new Intl.PluralRules(locale)));
  return rules;
}

function numbersFor(locale: Locale) {
  let format = numberFormats.get(locale);
  if (!format) numberFormats.set(locale, (format = new Intl.NumberFormat(locale)));
  return format;
}

/**
 * Resolves `key` in `messages`, falling back to `fallback` (English) for a
 * message a translation lacks, and to the key itself when neither has it.
 * A plural message picks its form from `values.count`.
 */
export function translate(
  locale: Locale,
  messages: MessageTree,
  fallback: MessageTree,
  key: string,
  values?: MessageValues,
): string {
  let message = lookup(messages, key);
  let messageLocale = locale;
  if (message === undefined) {
    message = lookup(fallback, key);
    messageLocale = "en";
  }
  if (message === undefined) return key;

  let text: string;
  if (typeof message === "string") {
    text = message;
  } else {
    const count = Number(values?.count ?? 0);
    const category = rulesFor(messageLocale).select(count) as keyof Plural;
    // "=0"-style exact matches are expressed as `zero`, which CLDR only
    // assigns in a few languages, so an explicit zero form wins for 0.
    text = (count === 0 && message.zero) || message[category] || message.other;
  }

  if (!values) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = values[name];
    if (value === undefined) return match;
    return typeof value === "number" ? numbersFor(locale).format(value) : value;
  });
}
