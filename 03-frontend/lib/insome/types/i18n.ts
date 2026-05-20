export const LOCALES = ["zh", "en"] as const;
export type LocaleCode = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: LocaleCode = "zh";
export const LOCALE_COOKIE = "insome_lang";
