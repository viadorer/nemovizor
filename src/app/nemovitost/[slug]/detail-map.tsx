"use client";

import dynamic from "next/dynamic";
import type { Property } from "@/lib/types";
import { ErrorBoundary } from "@/components/error-boundary";

const PropertyMap = dynamic(() => import("@/components/property-map"), {
  ssr: false,
  loading: () => (
    <div style={{ borderRadius: 12, border: "1px dashed var(--border)", padding: "32px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem", background: "var(--bg-filter)" }}>
      Načítání mapy…
    </div>
  ),
});

export function DetailMap({
  latitude,
  longitude,
  title,
  price,
  height = "250px",
}: {
  latitude: number;
  longitude: number;
  title: string;
  price: number;
  height?: string;
}) {
  // Create a minimal property object for the map
  const mapProperty = {
    id: "detail",
    latitude,
    longitude,
    title,
    price,
    featured: false,
    listingType: "sale" as const,
    slug: "",
    category: "apartment" as const,
    subtype: "",
    roomsLabel: "",
    area: 0,
    imageSrc: "",
    imageAlt: "",
    district: "",
    city: "",
    locationLabel: "",
    summary: "",
    condition: "",
    ownership: "",
    furnishing: "",
    energyRating: "",
    parking: "",
    balcony: false,
    terrace: false,
    garden: false,
    elevator: false,
    cellar: false,
    garage: false,
    pool: false,
    loggia: false,
    brokerName: "",
    brokerPhone: "",
    brokerEmail: "",
    agencyName: "",
    images: [],
    active: true,
  } satisfies Property;

  return (
    <ErrorBoundary>
      <PropertyMap
        properties={[mapProperty]}
        mode="markers"
        singleProperty
        height={height}
      />
    </ErrorBoundary>
  );
}

/** Wide-screen sidebar map — same look as listings page */
export function WideDetailMap({
  properties,
  selectedPropertyId,
  height = "100%",
}: {
  properties: Property[];
  selectedPropertyId?: string;
  height?: string;
}) {
  return (
    <ErrorBoundary>
      <PropertyMap
        properties={properties}
        selectedPropertyId={selectedPropertyId}
        mode="prices"
        height={height}
      />
    </ErrorBoundary>
  );
}
