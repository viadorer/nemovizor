"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Translation } from "./types";
import { t as defaultTranslation } from "./index";

const TranslationContext = createContext<Translation>(defaultTranslation);

/**
 * TranslationProvider – poskytuje překlad přes React context.
 * Používá se v layout.tsx, aby všechny komponenty měly přístup k t().
 */
export function TranslationProvider({
  children,
  translation,
}: {
  children: ReactNode;
  translation?: Translation;
}) {
  return (
    <TranslationContext.Provider value={translation || defaultTranslation}>
      {children}
    </TranslationContext.Provider>
  );
}

/**
 * useT() – hook pro přístup k překladům z klientských komponent.
 *
 * Použití:
 *   const t = useT();
 *   <h1>{t.hero.title}</h1>
 */
export function useT(): Translation {
  return useContext(TranslationContext);
}
