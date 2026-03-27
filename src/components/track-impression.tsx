"use client";

import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics";

/**
 * TrackImpression — wraps any element; fires a single "property_impression"
 * event the first time the element enters the viewport (via IntersectionObserver).
 */
export function TrackImpression({
  propertyId,
  listingType,
  category,
  price,
  children,
}: {
  propertyId: string;
  listingType?: string;
  category?: string;
  price?: number;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !firedRef.current) {
          firedRef.current = true;
          track("property_impression", {
            property_id: propertyId,
            listing_type: listingType ?? "",
            category: category ?? "",
            price: price ?? 0,
          });
          observer.disconnect();
        }
      },
      { threshold: 0.3 } // 30% visible = impression
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [propertyId, listingType, category, price]);

  return <div ref={ref} style={{ display: "contents" }}>{children}</div>;
}
