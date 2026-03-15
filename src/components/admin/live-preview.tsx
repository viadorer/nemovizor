"use client";

import { useState } from "react";
import { PropertyFormData, formatPreviewPrice } from "./property-form-types";
import { ListingTypes, PropertyCategories, type PropertyCategory } from "@/lib/types";

export function LivePreview({ form }: { form: PropertyFormData }) {
  const [collapsed, setCollapsed] = useState(true);
  const listingLabel = ListingTypes[form.listing_type as keyof typeof ListingTypes] || form.listing_type;
  const categoryLabel = PropertyCategories[form.category as PropertyCategory] || form.category;
  const priceStr = formatPreviewPrice(form.price, form.price_currency);

  const card = (
    <div className="pf-preview-card">
      <div className="property-image-wrapper" style={{ position: "relative" }}>
        {form.image_src ? (
          <img
            src={form.image_src}
            alt={form.image_alt || "N\u00e1hled"}
            className="property-image"
            style={{ width: "100%", height: 180, objectFit: "cover", borderRadius: "8px 8px 0 0" }}
          />
        ) : (
          <div className="pf-preview-placeholder">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
        )}
        <span className={`property-badge property-badge--${form.listing_type}`}>
          {listingLabel}
        </span>
      </div>
      <div className="property-info" style={{ padding: "12px" }}>
        <span className="property-price">{priceStr}</span>
        <div className="property-meta">
          <span>{categoryLabel}</span>
          {form.rooms_label && (
            <>
              <span className="property-meta-divider" />
              <span>{form.rooms_label}</span>
            </>
          )}
          {form.area > 0 && (
            <>
              <span className="property-meta-divider" />
              <span>{form.area} m\u00b2</span>
            </>
          )}
        </div>
        {(form.location_label || form.city) && (
          <span className="property-location">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {form.location_label || form.city}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="pf-preview-sidebar">
        <h4 className="pf-preview-sidebar__title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          {"N\u00e1hled"}
        </h4>
        {card}
        {form.title && <p className="pf-preview-title">{form.title}</p>}
      </div>

      {/* Mobile toggle */}
      <div className="pf-preview-mobile">
        <button
          type="button"
          className="pf-preview-mobile__toggle"
          onClick={() => setCollapsed(!collapsed)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          {"N\u00e1hled"}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ transform: collapsed ? "rotate(0deg)" : "rotate(180deg)", transition: "transform 0.2s" }}
          >
            <path d="M18 15l-6-6-6 6" />
          </svg>
        </button>
        {!collapsed && (
          <div className="pf-preview-mobile__body">
            {card}
          </div>
        )}
      </div>
    </>
  );
}
