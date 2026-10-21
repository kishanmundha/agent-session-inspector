import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, isLocale, negotiateLocale, type Locale } from "./config";
import { en, type MessageId, type Messages } from "./messages/en";
import { az } from "./messages/az";
import { de } from "./messages/de";
import { es } from "./messages/es";
import { fr } from "./messages/fr";
import { id } from "./messages/id";
import { ja } from "./messages/ja";
import { ko } from "./messages/ko";
import { pl } from "./messages/pl";
import { ptBR } from "./messages/pt-BR";
import { ru } from "./messages/ru";
import { th } from "./messages/th";
import { tr } from "./messages/tr";
import { uk } from "./messages/uk";
import { vi } from "./messages/vi";
import { zhCN } from "./messages/zh-CN";
import { zhTW } from "./messages/zh-TW";
import { translate, type MessageTree, type MessageValues } from "./translate";

const MESSAGES: Record<Locale, Messages> = {
  en,
  az,
  de,
  es,
  fr,
  id,
  ja,
  ko,
  pl,
  "pt-BR": ptBR,
  ru,
  th,
  tr,
  uk,
  vi,
  "zh-CN": zhCN,
  "zh-TW": zhTW,
};

/** The picker's choice, else the browser's preferred language, else English. */
export async function getLocale(): Promise<Locale> {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;
  return negotiateLocale((await headers()).get("accept-language"));
}

export function getMessages(locale: Locale): Messages {
  return MESSAGES[locale];
}

/** Translator for server code such as metadata. */
export async function getTranslator() {
  const locale = await getLocale();
  const messages = getMessages(locale);
  return (key: MessageId, values?: MessageValues) =>
    translate(
      locale,
      messages as unknown as MessageTree,
      en as unknown as MessageTree,
      key,
      values,
    );
}
