import type { LocaleCode } from "@/lib/insome/types";
import { LOCALES, DEFAULT_LOCALE, LOCALE_COOKIE } from "@/lib/insome/types";

export { LOCALES, DEFAULT_LOCALE, LOCALE_COOKIE };
export type { LocaleCode };

export const isLocale = (value: unknown): value is LocaleCode =>
  typeof value === "string" && (LOCALES as ReadonlyArray<string>).includes(value);
