"use client";

import { memo } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatPrice } from "@/lib/api";
import { Property } from "@/lib/types";
import { FavoriteButton } from "@/components/favorite-button";
import { useT } from "@/i18n/provider";

type PropertyRowProps = {
  property: Property;
};

export const PropertyRow = memo(function PropertyRow({ property }: PropertyRowProps) {
  const t = useT();
  return (
    <div className="property-row">
      <div className="property-row__image-wrapper">
        <Link href={`/nemovitost/${property.slug}`} className="property-row__image-link">
          <Image
            src={property.imageSrc}
            alt={property.imageAlt}
            className="property-row__image"
            width={320}
            height={220}
            loading="lazy"
            sizes="(max-width: 768px) 100vw, 280px"
          />
        </Link>
        <FavoriteButton propertyId={property.id} />
        <span className={`property-badge property-badge--${property.listingType}`}>
          {t.enumLabels.listingTypes[property.listingType] || property.listingType}
        </span>
        {property.featured && (
          <span className="property-badge property-badge--featured">{t.badges.premium}</span>
        )}
        <div className="property-broker-avatar">
          {property.showAgencyLogo ? (
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
      </div>

      <div className="property-row__body">
        <Link href={`/nemovitost/${property.slug}`} className="property-row__title">
          {property.summary || property.imageAlt || t.header.property}
        </Link>

        <span className="property-price">
          {formatPrice(property.price, property.priceCurrency)}
        </span>

        <div className="property-meta">
          <span>{t.enumLabels.propertyCategories[property.category] || property.category}</span>
          {property.roomsLabel && (
            <>
              <span className="property-meta-divider" />
              <span>{property.roomsLabel}</span>
            </>
          )}
          {property.area > 0 && (
            <>
              <span className="property-meta-divider" />
              <span>{property.area} m{"\u00b2"}</span>
            </>
          )}
        </div>

        <span className="property-location">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          {property.locationLabel || property.city || property.district}
        </span>

        {property.description && (
          <p className="property-row__desc">
            {property.description.slice(0, 200).replace(/\n/g, " ").trim()}
            {property.description.length > 200 ? "\u2026" : ""}
          </p>
        )}

        <div className="property-row__actions">
          {property.brokerPhone && (
            <a
              href={`tel:${property.brokerPhone}`}
              className="property-row__action"
              onClick={(e) => e.stopPropagation()}
              title={t.detail.callBroker}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              {t.header.phone}
            </a>
          )}
          {property.brokerEmail && (
            <a
              href={`mailto:${property.brokerEmail}`}
              className="property-row__action"
              onClick={(e) => e.stopPropagation()}
              title={t.detail.emailBroker}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
              E-mail
            </a>
          )}
          <Link
            href={`/nemovitost/${property.slug}`}
            className="property-row__action property-row__action--primary"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            {t.header.detail}
          </Link>
        </div>
      </div>
    </div>
  );
});
