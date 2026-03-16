import Link from "next/link";
import type { Agency, Broker, Branch, Review } from "@/lib/types";

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span className="profile-stars">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={i <= Math.round(rating) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
  );
}

// ===== Agency Profile Header =====

type AgencyProfileHeaderProps = {
  agency: Agency;
  parentAgency?: Agency | null;
  hqBranch?: Branch | null;
  reviews: Review[];
};

export function AgencyProfileHeader({ agency, parentAgency, hqBranch, reviews }: AgencyProfileHeaderProps) {
  return (
    <div className="ph">
      {/* Row 1: Identity + Stats */}
      <div className="ph-top">
        <div className="ph-identity">
          <div className="ph-logo">
            {agency.logo ? (
              <img src={agency.logo} alt={agency.name} />
            ) : (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 21h18M3 7v14M21 7v14M6 11h4M6 15h4M14 11h4M14 15h4M9 21v-4h6v4M12 3l9 4H3l9-4z" />
              </svg>
            )}
          </div>
          <div className="ph-name-block">
            <h1 className="ph-name">{agency.name}</h1>
            {agency.foundedYear > 0 && (
              <span className="ph-meta">Zalozena {agency.foundedYear}</span>
            )}
            {parentAgency && (
              <span className="ph-meta">
                Pobocka{" "}
                <Link href={`/kancelare/${parentAgency.slug}`} className="ph-link">{parentAgency.name}</Link>
              </span>
            )}
          </div>
        </div>
        <div className="ph-stats">
          <div className="ph-stat">
            <span className="ph-stat-val">{agency.totalListings.toLocaleString("cs")}</span>
            <span className="ph-stat-lbl">Nabidek</span>
          </div>
          <div className="ph-stat">
            <span className="ph-stat-val">{agency.totalBrokers}</span>
            <span className="ph-stat-lbl">Makleru</span>
          </div>
          {agency.rating > 0 && (
            <div className="ph-stat">
              <span className="ph-stat-val ph-stat-rating">
                {agency.rating} <Stars rating={agency.rating} />
              </span>
              <span className="ph-stat-lbl">{reviews.length > 0 ? `${reviews.length} hodnoceni` : "Hodnoceni"}</span>
            </div>
          )}
          {agency.totalDeals > 0 && (
            <div className="ph-stat">
              <span className="ph-stat-val">{agency.totalDeals}</span>
              <span className="ph-stat-lbl">Obchodu</span>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Contacts */}
      <div className="ph-contacts">
        {hqBranch ? (
          <span className="ph-contact">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {hqBranch.address}, {hqBranch.city}
          </span>
        ) : (agency.seatAddress || agency.seatCity) ? (
          <span className="ph-contact">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {[agency.seatAddress, agency.seatCity].filter(Boolean).join(", ")}
          </span>
        ) : null}
        {agency.phone && (
          <a href={`tel:${agency.phone}`} className="ph-contact">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            {agency.phone}
          </a>
        )}
        {agency.email && (
          <a href={`mailto:${agency.email}`} className="ph-contact">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <path d="M22 6l-10 7L2 6" />
            </svg>
            {agency.email}
          </a>
        )}
        {agency.website && (
          <a href={agency.website} target="_blank" rel="noopener noreferrer" className="ph-contact ph-contact--accent">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            {agency.website.replace(/^https?:\/\/(www\.)?/, "")}
          </a>
        )}
      </div>

      {/* Row 3: Description + Tags (only if present) */}
      {(agency.description || agency.specializations.length > 0) && (
        <div className="ph-extra">
          {agency.description && (
            <p className="ph-bio">{agency.description}</p>
          )}
          {agency.specializations.length > 0 && (
            <div className="ph-tags">
              {agency.specializations.map((s) => (
                <span key={s} className="ph-tag">{s}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ===== Broker Profile Header =====

type BrokerProfileHeaderProps = {
  broker: Broker;
  agency: Agency | null;
  reviews: Review[];
  agencyAddress?: string;
};

export function BrokerProfileHeader({ broker, agency, reviews, agencyAddress }: BrokerProfileHeaderProps) {
  return (
    <div className="ph">
      {/* Row 1: Identity + Stats */}
      <div className="ph-top">
        <div className="ph-identity">
          <div className={`ph-avatar ${!broker.photo ? "ph-avatar--placeholder" : ""}`}>
            {broker.photo ? (
              <img src={broker.photo} alt={broker.name} />
            ) : (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            )}
          </div>
          <div className="ph-name-block">
            <h1 className="ph-name">{broker.name}</h1>
            <div className="ph-meta-row">
              {agency && (
                <Link href={`/kancelare/${agency.slug}`} className="ph-agency-link">
                  {agency.logo && <img src={agency.logo} alt={agency.name} className="ph-agency-logo" />}
                  {agency.name}
                </Link>
              )}
              {broker.specialization && <span className="ph-meta">{broker.specialization}</span>}
              {broker.yearStarted && <span className="ph-meta">Od roku {broker.yearStarted}</span>}
            </div>
          </div>
        </div>
        <div className="ph-stats">
          <div className="ph-stat">
            <span className="ph-stat-val">{broker.activeListings.toLocaleString("cs")}</span>
            <span className="ph-stat-lbl">Nabidek</span>
          </div>
          {broker.rating > 0 && (
            <div className="ph-stat">
              <span className="ph-stat-val ph-stat-rating">
                {broker.rating} <Stars rating={broker.rating} />
              </span>
              <span className="ph-stat-lbl">{reviews.length > 0 ? `${reviews.length} hodnoceni` : "Hodnoceni"}</span>
            </div>
          )}
          {broker.totalDeals > 0 && (
            <div className="ph-stat">
              <span className="ph-stat-val">{broker.totalDeals}</span>
              <span className="ph-stat-lbl">Obchodu</span>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Contacts */}
      <div className="ph-contacts">
        {agencyAddress && (
          <span className="ph-contact">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {agencyAddress}
          </span>
        )}
        {broker.phone && (
          <a href={`tel:${broker.phone}`} className="ph-contact">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            {broker.phone}
          </a>
        )}
        {broker.email && (
          <a href={`mailto:${broker.email}`} className="ph-contact">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <path d="M22 6l-10 7L2 6" />
            </svg>
            {broker.email}
          </a>
        )}
      </div>

      {/* Row 3: Bio + Tags (only if present) */}
      {(broker.bio || (broker.languages?.length ?? 0) > 0 || (broker.certifications?.length ?? 0) > 0) && (
        <div className="ph-extra">
          {broker.bio && <p className="ph-bio">{broker.bio}</p>}
          {((broker.languages?.length ?? 0) > 0 || (broker.certifications?.length ?? 0) > 0) && (
            <div className="ph-tags">
              {broker.languages?.map((l) => <span key={l} className="ph-tag">{l}</span>)}
              {broker.certifications?.map((c) => <span key={c} className="ph-tag ph-tag--cert">{c}</span>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
