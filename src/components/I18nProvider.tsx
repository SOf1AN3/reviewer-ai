"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { Locale } from "@/lib/i18n";
import { locales } from "@/lib/i18n";

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextType>({
  locale: "fr",
  setLocale: () => {},
});

export function useI18n() {
  return useContext(I18nContext);
}

export function I18nProvider({
  locale: initialLocale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const router = useRouter();
  const pathname = usePathname();

  const setLocale = useCallback(
    (newLocale: Locale) => {
      setLocaleState(newLocale);
      document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=31536000`;
      const segments = pathname.split("/");
      if (locales.includes(segments[1] as Locale)) {
        segments[1] = newLocale;
      } else {
        segments.splice(1, 0, newLocale);
      }
      router.push(segments.join("/") || "/");
      router.refresh();
    },
    [pathname, router]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}
