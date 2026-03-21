"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import type { Translation } from "./types";
import { t as defaultTranslation, translations } from "./index";
import { brand } from "@/brands";

type LocaleContextType = {
  t: Translation;
  locale: string;
  setLocale: (locale: string) => void;
};

const STORAGE_KEY = "nemovizor-locale";

const LocaleContext = createContext<LocaleContextType>({
  t: defaultTranslation,
  locale: brand.locale,
  setLocale: () => {},
});

export function TranslationProvider({
  children,
  translation,
}: {
  children: ReactNode;
  translation?: Translation;
}) {
  const [locale, setLocaleState] = useState(brand.locale);
  const [currentT, setCurrentT] = useState<Translation>(translation || defaultTranslation);

  // Load saved locale from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && translations[saved]) {
        setLocaleState(saved);
        setCurrentT(translations[saved]);
        document.documentElement.lang = saved;
      }
    } catch {}
  }, []);

  const setLocale = useCallback((newLocale: string) => {
    if (translations[newLocale]) {
      setLocaleState(newLocale);
      setCurrentT(translations[newLocale]);
      try {
        localStorage.setItem(STORAGE_KEY, newLocale);
        document.documentElement.lang = newLocale;
      } catch {}
    }
  }, []);

  return (
    <LocaleContext.Provider value={{ t: currentT, locale, setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

/**
 * useT() – hook pro přístup k překladům z klientských komponent.
 */
export function useT(): Translation {
  return useContext(LocaleContext).t;
}

/**
 * useLocale() – hook pro přístup k locale a přepínání jazyka.
 */
export function useLocale() {
  const { locale, setLocale } = useContext(LocaleContext);
  return { locale, setLocale };
}
