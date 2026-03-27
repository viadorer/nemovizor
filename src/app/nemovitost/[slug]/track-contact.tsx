"use client";

import { track } from "@/lib/analytics";

/**
 * TrackPhoneLink — phone link that tracks the click
 */
export function TrackPhoneLink({
  phone,
  propertyId,
  children,
}: {
  phone: string;
  propertyId: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={`tel:${phone}`}
      style={{ color: "inherit", textDecoration: "none" }}
      onClick={() => track("phone_click", { property_id: propertyId, phone })}
    >
      {children}
    </a>
  );
}

/**
 * TrackEmailLink — email link that tracks the click
 */
export function TrackEmailLink({
  email,
  propertyId,
  children,
}: {
  email: string;
  propertyId: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={`mailto:${email}`}
      style={{ color: "inherit", textDecoration: "none" }}
      onClick={() => track("email_click", { property_id: propertyId, email })}
    >
      {children}
    </a>
  );
}

/**
 * TrackContactButton — "Contact broker" button that tracks the click
 */
export function TrackContactButton({
  propertyId,
  label,
}: {
  propertyId: string;
  label: string;
}) {
  return (
    <button
      className="detail-cta-btn detail-cta-btn--primary"
      onClick={() => track("contact_broker_click", { property_id: propertyId })}
    >
      {label}
    </button>
  );
}
