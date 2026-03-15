import Link from "next/link";
import type { Agency, Broker, Branch, Review } from "@/lib/types";

function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
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

// ===== About Card =====

type AgencyAboutCardProps = {
  agency: Agency;
  parentAgency?: Agency | null;
};

export function AgencyAboutCard({ agency, parentAgency }: AgencyAboutCardProps) {
  return (
    <div className="profile-card">
      <div className="profile-card-header">
        <div className="profile-card-logo">
          {agency.logo ? (
            <img src={agency.logo} alt={agency.name} />
          ) : (
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 21h18M3 7v14M21 7v14M6 11h4M6 15h4M14 11h4M14 15h4M9 21v-4h6v4M12 3l9 4H3l9-4z" />
            </svg>
          )}
        </div>
        <div className="profile-card-info">
          <h2 className="profile-card-name">{agency.name}</h2>
          {agency.foundedYear > 0 && (
            <div className="profile-card-since">Zalozena {agency.foundedYear}</div>
          )}
        </div>
      </div>

      <div className="profile-card-contacts">
        {agency.phone && (
          <a href={`tel:${agency.phone}`} className="profile-card-contact">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            {agency.phone}
          </a>
        )}
        {agency.email && (
          <a href={`mailto:${agency.email}`} className="profile-card-contact">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <path d="M22 6l-10 7L2 6" />
            </svg>
            {agency.email}
          </a>
        )}
        {agency.website && (
          <a href={agency.website} target="_blank" rel="noopener noreferrer" className="profile-card-contact profile-card-contact--link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            {agency.website.replace(/^https?:\/\/(www\.)?/, "")}
          </a>
        )}
      </div>

      {agency.specializations.length > 0 && (
        <div className="profile-card-tags">
          {agency.specializations.map((spec) => (
            <span key={spec} className="profile-card-tag">{spec}</span>
          ))}
        </div>
      )}

      {agency.description && (
        <div className="profile-card-bio">
          <p>{agency.description}</p>
        </div>
      )}

      {parentAgency && (
        <div className="profile-card-parent">
          <span className="profile-card-parent-label">Pobocka:</span>
          <Link href={`/kancelare/${parentAgency.slug}`} className="profile-card-parent-link">
            {parentAgency.name}
          </Link>
        </div>
      )}
    </div>
  );
}

// ===== Stats Card =====

type AgencyStatsCardProps = {
  agency: Agency;
};

export function AgencyStatsCard({ agency }: AgencyStatsCardProps) {
  return (
    <div className="profile-card">
      <h3 className="profile-card-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 20V10M12 20V4M6 20v-6" />
        </svg>
        Statistiky
      </h3>
      <div className="profile-stats-grid">
        <div className="profile-stat">
          <div className="profile-stat-value">{agency.totalListings.toLocaleString("cs")}</div>
          <div className="profile-stat-label">Aktivnich nabidek</div>
        </div>
        <div className="profile-stat">
          <div className="profile-stat-value">{agency.totalBrokers}</div>
          <div className="profile-stat-label">Makleru</div>
        </div>
        <div className="profile-stat">
          <div className="profile-stat-value">{agency.rating > 0 ? agency.rating : "-"}</div>
          <div className="profile-stat-label">Hodnoceni</div>
        </div>
        <div className="profile-stat">
          <div className="profile-stat-value">{agency.totalDeals}</div>
          <div className="profile-stat-label">Obchodu</div>
        </div>
      </div>
    </div>
  );
}

// ===== Reviews Card =====

type AgencyReviewsCardProps = {
  agency: Agency;
  reviews: Review[];
};

export function AgencyReviewsCard({ agency, reviews }: AgencyReviewsCardProps) {
  return (
    <div className="profile-card">
      <h3 className="profile-card-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
        Hodnoceni
      </h3>

      {reviews.length > 0 ? (
        <>
          <div className="profile-reviews-summary">
            <span className="profile-reviews-avg">{agency.rating}</span>
            <Stars rating={agency.rating} size={18} />
            <span className="profile-reviews-count">({reviews.length})</span>
          </div>
          <div className="profile-reviews-list">
            {reviews.map((review) => (
              <div key={review.id} className="profile-review">
                <div className="profile-review-header">
                  <span className="profile-review-author">{review.authorName}</span>
                  <Stars rating={review.rating} size={14} />
                </div>
                <p className="profile-review-text">{review.text}</p>
                <span className="profile-review-date">
                  {new Date(review.date).toLocaleDateString("cs-CZ", { year: "numeric", month: "long", day: "numeric" })}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="profile-card-empty">Zatim zadne hodnoceni</p>
      )}
    </div>
  );
}

// ===== Brokers Grid (for agency detail "Makleri" mode) =====

type AgencyBrokersGridProps = {
  brokers: Broker[];
};

export function AgencyBrokersGrid({ brokers }: AgencyBrokersGridProps) {
  return (
    <div className="profile-brokers-grid">
      {brokers.map((broker) => (
        <Link
          key={broker.id}
          href={`/makleri/${broker.slug}`}
          className="profile-broker-card"
        >
          <div className="profile-broker-card-top">
            <div className="profile-broker-avatar">
              {broker.photo ? (
                <img src={broker.photo} alt={broker.name} />
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              )}
            </div>
            <div>
              <div className="profile-broker-name">{broker.name}</div>
              <div className="profile-broker-spec">{broker.specialization}</div>
            </div>
          </div>
          <div className="profile-broker-stats">
            <div className="profile-stat profile-stat--sm">
              <div className="profile-stat-value">{broker.activeListings}</div>
              <div className="profile-stat-label">Nabidek</div>
            </div>
            <div className="profile-stat profile-stat--sm">
              <div className="profile-stat-value">{broker.rating > 0 ? broker.rating : "-"}</div>
              <div className="profile-stat-label">Hodnoceni</div>
            </div>
            <div className="profile-stat profile-stat--sm">
              <div className="profile-stat-value">{broker.totalDeals}</div>
              <div className="profile-stat-label">Obchodu</div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ===== Branches Grid (for agency detail "Pobocky" mode) =====

type AgencyBranchesGridProps = {
  branches: Branch[];
};

export function AgencyBranchesGrid({ branches }: AgencyBranchesGridProps) {
  const sorted = [...branches].sort((a, b) => (b.isHeadquarters ? 1 : 0) - (a.isHeadquarters ? 1 : 0));

  return (
    <div className="profile-branches-grid">
      {sorted.map((branch) => (
        <div key={branch.id} className="profile-branch-card">
          <div className="profile-branch-name">
            {branch.city}
            {branch.isHeadquarters && <span className="profile-branch-hq">Hlavni kancelar</span>}
          </div>
          <div className="profile-branch-address">{branch.address}</div>
          {branch.phone && (
            <a href={`tel:${branch.phone}`} className="profile-branch-phone">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              {branch.phone}
            </a>
          )}
          {branch.email && (
            <a href={`mailto:${branch.email}`} className="profile-branch-email">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <path d="M22 6l-10 7L2 6" />
              </svg>
              {branch.email}
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
