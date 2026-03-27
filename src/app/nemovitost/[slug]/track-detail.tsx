"use client";

import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics";

/**
 * TrackDetail — fires analytics events for a property detail page:
 *   - property_view (once on mount, with referrer info)
 *   - scroll_depth (25 / 50 / 75 / 100 %)
 *   - time_on_page (on unmount / page hide)
 */
export function TrackDetail({
  propertyId,
  propertySlug,
  city,
  category,
  listingType,
  price,
}: {
  propertyId: string;
  propertySlug: string;
  city?: string;
  category?: string;
  listingType?: string;
  price?: number;
}) {
  const startRef = useRef(Date.now());
  const firedDepths = useRef(new Set<number>());

  // ── property_view on mount ──────────────────────────────────
  useEffect(() => {
    track("property_view", {
      property_id: propertyId,
      slug: propertySlug,
      city: city ?? "",
      category: category ?? "",
      listing_type: listingType ?? "",
      price: price ?? 0,
    });
  }, [propertyId, propertySlug, city, category, listingType, price]);

  // ── scroll depth ─────────────────────────────────────────────
  useEffect(() => {
    const milestones = [25, 50, 75, 100];

    function onScroll() {
      const scrolled = window.scrollY + window.innerHeight;
      const total = document.documentElement.scrollHeight;
      const pct = Math.round((scrolled / total) * 100);

      for (const m of milestones) {
        if (pct >= m && !firedDepths.current.has(m)) {
          firedDepths.current.add(m);
          track("scroll_depth", {
            property_id: propertyId,
            depth_pct: m,
          });
        }
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [propertyId]);

  // ── time on page (fired on leave) ────────────────────────────
  useEffect(() => {
    function fireTime() {
      const seconds = Math.round((Date.now() - startRef.current) / 1000);
      if (seconds < 2) return; // ignore accidental fast navigations
      track("time_on_page", {
        property_id: propertyId,
        seconds,
      });
    }

    const onHide = () => {
      if (document.visibilityState === "hidden") fireTime();
    };

    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", fireTime);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", fireTime);
    };
  }, [propertyId]);

  return null;
}
