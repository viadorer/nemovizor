import type { BrandConfig } from "./types";

function loadBrandConfig(): BrandConfig {
  const brandId = process.env.NEXT_PUBLIC_BRAND || "nemovizor";

  switch (brandId) {
    case "immo-a-porter":
      return require("./immo-a-porter/config").default;
    case "nemovizor":
    default:
      return require("./nemovizor/config").default;
  }
}

/** Aktivní brand konfigurace (dle NEXT_PUBLIC_BRAND env var) */
export const brand: BrandConfig = loadBrandConfig();

export type { BrandConfig } from "./types";
