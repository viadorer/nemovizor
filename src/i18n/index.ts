import { brand } from "@/brands";
import type { Translation } from "./types";
import cs from "./cs";
import en from "./en";
import fr from "./fr";

/** Mapování locale → překlad */
const translations: Record<string, Translation> = {
  cs,
  en,
  fr,
};

/** Aktivní překlad dle brandu */
export const t: Translation = translations[brand.locale] || translations.cs;

/** Přímý přístup ke všem překladům (pro dynamické přepínání) */
export { translations };

export type { Translation } from "./types";
