"use client";

import { useEffect } from "react";
import { getCurrentSearch, addSavedSearch } from "@/lib/saved-searches";

/**
 * Invisible client component that auto-saves the current search
 * when the user navigates to a property detail page.
 * Reads from sessionStorage (written by /nabidky page).
 */
export function AutoSaveSearch() {
  useEffect(() => {
    const current = getCurrentSearch();
    if (!current) return;

    // Only auto-save if there are meaningful filters set
    const f = current.filters;
    const hasFilters = f.listingType || f.category || f.subtype ||
      f.priceMin || f.priceMax || f.areaMin || f.areaMax;

    if (hasFilters) {
      addSavedSearch(current.filters, current.locationLabel);
    }
  }, []);

  return null;
}
