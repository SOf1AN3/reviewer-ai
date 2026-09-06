import fr from "@/messages/fr.json";
import en from "@/messages/en.json";
import ar from "@/messages/ar.json";

export const locales = ["fr", "en", "ar"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "fr";

const dictionaries = { fr, en, ar } as const;

export type Dictionary = typeof fr;

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries[defaultLocale];
}

export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}
