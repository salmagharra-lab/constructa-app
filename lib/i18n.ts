export const locales = ["he", "ar", "th"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "he";
export const LOCALE_COOKIE = "NEXT_LOCALE";
export const localeNames: Record<Locale, string> = { he: "עברית", ar: "العربية", th: "ไทย" };

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (locales as readonly string[]).includes(v);
}

export function dirFor(locale: string): "rtl" | "ltr" {
  return locale === "he" || locale === "ar" ? "rtl" : "ltr";
}
