"use client";

import Link from "next/link";
import type { Broker } from "@/lib/types";
import { useT } from "@/i18n/provider";

type Props = {
  broker: Broker;
};

export function BrokerGridCard({ broker }: Props) {
  const t = useT();
  return (
    <Link href={`/makleri/${broker.slug}`} className="property-card broker-grid-card">
      <div className="broker-grid-card__photo">
        {broker.photo ? (
          <img src={broker.photo} alt={broker.name} className="broker-grid-card__img" />
        ) : (
          <div className="broker-grid-card__avatar-placeholder">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
        )}
        <span className="property-badge property-badge--broker">{t.nav.brokers}</span>
      </div>
      <div className="property-info">
        <span className="property-price">{broker.name}</span>
        <div className="property-meta">
          <span>{broker.specialization}</span>
          {broker.agencyName && <span>{broker.agencyName}</span>}
        </div>
        <div className="property-location">
          {broker.activeListings > 0 && (
            <span>{broker.activeListings} {t.profile.activeListings}</span>
          )}
          {broker.rating > 0 && (
            <span>★ {broker.rating.toFixed(1)}</span>
          )}
        </div>
        <div className="broker-grid-card__cta">{t.detail.contactBroker}</div>
      </div>
    </Link>
  );
}
