import type { BrandConfig } from "../types";

const immoAPorterConfig: BrandConfig = {
  id: "immo-a-porter",
  name: "IMMO A PORTER",
  locale: "en",
  currency: "eur",

  metadata: {
    title: "IMMO A PORTER",
    description:
      "IMMO A PORTER - international real estate portal for properties, agents and locations.",
    url: "https://immoapporter.com",
  },

  logos: {
    dark: "/branding/immo_logo.png",
    light: "/branding/immo_logo_light.png",
    symbol: "/branding/immo_symbol.png",
  },

  hero: {
    backgroundDark: "/branding/hero.png",
    backgroundLight: "/branding/hero-light.png",
  },

  features: {
    valuation: false,
    sell: true,
    aiSearch: true,
  },

  routes: {
    listings: "/listings",
    property: "/property",
    brokers: "/agents",
    agencies: "/agencies",
    dashboard: "/dashboard",
    login: "/login",
    register: "/register",
    valuation: "/valuation",
    sell: "/sell",
  },
};

export default immoAPorterConfig;
