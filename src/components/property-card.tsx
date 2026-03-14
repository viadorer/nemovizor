import Link from "next/link";
import { formatPrice } from "@/lib/api";
import { Property, PropertyCategories } from "@/lib/types";

type PropertyCardProps = {
  property: Property;
};

export function PropertyCard({ property }: PropertyCardProps) {
  return (
    <Link href={`/nemovitost/${property.slug}`} className="property-card">
      <div className="property-image-wrapper">
        <img src={property.imageSrc} alt={property.imageAlt} className="property-image" />
        <span className={`property-badge property-badge--${property.listingType}`}>
          {property.listingType === "sale" ? "Prodej" : property.listingType === "rent" ? "Pronájem" : property.listingType === "auction" ? "Dražba" : property.listingType === "project" ? "Projekt" : "Podíly"}
        </span>
        {property.featured && (
          <span className="property-badge property-badge--featured">Premium</span>
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
              <span className="property-media-badge property-media-badge--hot" title="Vysoký zájem">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <path d="M12 2c0 4-4 6-4 10a4 4 0 0 0 8 0c0-4-4-6-4-10zM12 18a2 2 0 0 1-2-2c0-1.3 2-2 2-4 0 2 2 2.7 2 4a2 2 0 0 1-2 2z" />
                </svg>
              </span>
            )}
            {property.matterportUrl && (
              <span className="property-media-badge" title="3D prohlídka">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
                3D
              </span>
            )}
            {property.videoUrl && (
              <span className="property-media-badge" title="Video">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Video
              </span>
            )}
          </div>
        )}
      </div>
      <div className="property-info">
        <span className="property-price">{formatPrice(property.price)}</span>
        <div className="property-meta">
          <span>{PropertyCategories[property.category] ?? property.category}</span>
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
}
