import type { BrandConfig } from "../types";

const nemovizorConfig: BrandConfig = {
  id: "nemovizor",
  name: "Nemovizor",
  locale: "cs",
  currency: "czk",

  metadata: {
    title: "Nemovizor",
    description:
      "Nemovizor - realitní portál pro vyhledávání nemovitostí, makléřů a lokalit.",
    url: "https://nemovizor.cz",
  },

  logos: {
    dark: "/branding/nemovizor_logo.png",
    light: "/branding/nemovizor_logo_light.png",
    symbol: "/branding/nemovizor_symbol.png",
  },

  hero: {
    backgroundDark: "/branding/hero.png",
    backgroundLight: "/branding/hero-light.png",
  },

  features: {
    valuation: true,
    sell: true,
    aiSearch: true,
  },

  routes: {
    listings: "/nabidky",
    property: "/nemovitost",
    brokers: "/makleri",
    agencies: "/kancelare",
    dashboard: "/dashboard",
    login: "/prihlaseni",
    register: "/registrace",
    valuation: "/oceneni",
    sell: "/prodat",
  },
};

export default nemovizorConfig;
