"use client";

import { Fragment, createContext, useContext, useMemo, type ReactNode } from "react";
import { DEFAULT_LOCALE, type Locale } from "./config";
import { setFormatLocale } from "./current";
import { en, type MessageId, type Messages } from "./messages/en";
import { translate, type MessageTree, type MessageValues } from "./translate";

type RichTags = Record<string, (chunks: ReactNode) => ReactNode>;

export interface Translator {
  (key: MessageId, values?: MessageValues): string;
  /**
   * A message with markup: `<b>{count}</b> failed` renders `<b>` through
   * `tags.b`. Tags do not nest.
   */
  rich(key: MessageId, tags: RichTags, values?: MessageValues): ReactNode;
}

interface I18nValue {
  locale: Locale;
  t: Translator;
}

function makeTranslator(locale: Locale, messages: Messages): Translator {
  const t = ((key, values) =>
    translate(
      locale,
      messages as unknown as MessageTree,
      en as unknown as MessageTree,
      key,
      values,
    )) as Translator;
  t.rich = (key, tags, values) => {
    const text = t(key, values);
    const parts: ReactNode[] = [];
    const pattern = /<(\w+)>(.*?)<\/\1>/g;
    let last = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text))) {
      if (match.index > last) parts.push(text.slice(last, match.index));
      const render = tags[match[1]];
      parts.push(
        <Fragment key={match.index}>{render ? render(match[2]) : match[2]}</Fragment>,
      );
      last = match.index + match[0].length;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts;
  };
  return t;
}

const I18nContext = createContext<I18nValue>({
  locale: DEFAULT_LOCALE,
  t: makeTranslator(DEFAULT_LOCALE, en),
});

/**
 * Gives the tree the active language. The root layout picks the locale and
 * sends only that language's messages, so the client never loads the others.
 */
export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: ReactNode;
}) {
  // Set during render, not in an effect, so the server's HTML and the first
  // client render format numbers and dates the same way.
  setFormatLocale(locale);
  const value = useMemo(
    () => ({ locale, t: makeTranslator(locale, messages) }),
    [locale, messages],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): Translator {
  return useContext(I18nContext).t;
}

export function useLocale(): Locale {
  return useContext(I18nContext).locale;
}
