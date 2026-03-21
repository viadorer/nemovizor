/** Konfigurace značky – každý brand musí implementovat celý interface */
export type BrandConfig = {
  /** Unikátní identifikátor brandu */
  id: string;
  /** Zobrazovaný název */
  name: string;
  /** Výchozí locale (cs, en, fr, de, ...) */
  locale: string;
  /** Výchozí měna */
  currency: string;

  /** SEO metadata */
  metadata: {
    title: string;
    description: string;
    url: string;
  };

  /** Cesty k logům */
  logos: {
    dark: string;
    light: string;
    symbol: string;
  };

  /** Hero pozadí */
  hero: {
    backgroundDark: string;
    backgroundLight: string;
  };

  /** Funkce zapnuté/vypnuté per brand */
  features: {
    valuation: boolean;
    sell: boolean;
    aiSearch: boolean;
  };

  /** URL routes – mapování na filesystem routes */
  routes: {
    listings: string;
    property: string;
    brokers: string;
    agencies: string;
    dashboard: string;
    login: string;
    register: string;
    valuation: string;
    sell: string;
  };
};
