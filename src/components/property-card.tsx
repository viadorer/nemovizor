"use client";

import { memo, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatPrice } from "@/lib/api";
import { Property } from "@/lib/types";
import { FavoriteButton } from "@/components/favorite-button";
import { useT } from "@/i18n/provider";
import { track } from "@/lib/analytics";

type PropertyCardProps = {
  property: Property;
  isTip?: boolean;
};

export const PropertyCard = memo(function PropertyCard({ property, isTip }: PropertyCardProps) {
  const t = useT();

  // Build image list: use images[] if available, else fall back to imageSrc
  const images: string[] = property.images?.length
    ? property.images
    : property.imageSrc
    ? [property.imageSrc]
    : [];
  const hasMultiple = images.length > 1;

  const [idx, setIdx] = useState(0);

  const prev = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIdx((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);

  const next = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIdx((i) => (i + 1) % images.length);
  }, [images.length]);

  const currentSrc = images[idx] || property.imageSrc;
  const currentAlt = idx === 0 ? property.imageAlt : `${property.imageAlt} ${idx + 1}`;

  return (
    <Link href={`/nemovitost/${property.slug}`} className="property-card" onClick={() => track("property_card_click", { property_id: property.id, slug: property.slug, listing_type: property.listingType, price: property.price })}>
      <div className="property-image-wrapper">
        <Image
          src={currentSrc}
          alt={currentAlt}
          className="property-image"
          width={400}
          height={300}
          loading="lazy"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
        <FavoriteButton propertyId={property.id} />
        <span className={`property-badge property-badge--${property.listingType}`}>
          {t.enumLabels.listingTypes[property.listingType] || property.listingType}
        </span>
        {isTip && (
          <span className="property-badge property-badge--featured">{t.badges.tip}</span>
        )}
        <div className="property-broker-avatar">
          {property.brokerPhoto ? (
            <img src={property.brokerPhoto} alt={property.brokerName} />
          ) : property.showAgencyLogo ? (
            <img src="/branding/logo.png" alt={property.agencyName} />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          )}
        </div>
        {(property.matterportUrl || property.videoUrl || property.viewsTrend === "hot") && (
          <div className="property-media-badges">
            {property.viewsTrend === "hot" && (
              <span className="property-media-badge property-media-badge--hot" title={t.header.highInterest}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <path d="M12 2c0 4-4 6-4 10a4 4 0 0 0 8 0c0-4-4-6-4-10zM12 18a2 2 0 0 1-2-2c0-1.3 2-2 2-4 0 2 2 2.7 2 4a2 2 0 0 1-2 2z" />
                </svg>
              </span>
            )}
            {property.matterportUrl && (
              <span className="property-media-badge" title={t.detail.virtualTour}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
                3D
              </span>
            )}
            {property.videoUrl && (
              <span className="property-media-badge" title={t.header.video}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                {t.header.video}
              </span>
            )}
          </div>
        )}

        {/* Photo navigation arrows — visible on hover when multiple images */}
        {hasMultiple && (
          <>
            <button className="pc-arrow pc-arrow--prev" onClick={prev} aria-label="Předchozí foto">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button className="pc-arrow pc-arrow--next" onClick={next} aria-label="Další foto">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
            <div className="pc-dots">
              {images.slice(0, 8).map((_, i) => (
                <span key={i} className={`pc-dot${i === idx ? " pc-dot--active" : ""}`} />
              ))}
            </div>
          </>
        )}
      </div>
      <div className="property-info">
        <span className="property-price">{formatPrice(property.price, property.priceCurrency)}</span>
        <div className="property-meta">
          <span>{t.enumLabels.propertyCategories[property.category] || property.category}</span>
          <span className="property-meta-divider" />
          <span>{property.roomsLabel}</span>
          <span className="property-meta-divider" />
          <span>{property.area} m²</span>
        </div>
        <span className="property-location">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          {property.locationLabel}
        </span>
      </div>
    </Link>
  );
});
