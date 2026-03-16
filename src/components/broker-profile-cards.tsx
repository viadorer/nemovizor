import Link from "next/link";
import type { Broker, Agency, Review } from "@/lib/types";

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

type BrokerAboutCardProps = {
  broker: Broker;
  agency: Agency | null;
  agencyAddress?: string;
};

export function BrokerAboutCard({ broker, agency, agencyAddress }: BrokerAboutCardProps) {
  return (
    <div className="profile-card">
      <div className="profile-card-header">
        <div className="profile-card-avatar">
          {broker.photo ? (
            <img src={broker.photo} alt={broker.name} />
          ) : (
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          )}
        </div>
        <div className="profile-card-info">
          <h2 className="profile-card-name">{broker.name}</h2>
          {agency && (
            <Link href={`/kancelare/${agency.slug}`} className="profile-card-agency">
              {agency.logo && (
                <img src={agency.logo} alt={agency.name} className="profile-card-agency-logo" />
              )}
              {agency.name}
            </Link>
          )}
          <div className="profile-card-spec">{broker.specialization}</div>
          {broker.yearStarted && (
            <div className="profile-card-since">Od roku {broker.yearStarted}</div>
          )}
        </div>
      </div>

      <div className="profile-card-contacts">
        {agencyAddress && (
          <span className="profile-card-contact">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {agencyAddress}
          </span>
        )}
        {broker.phone && (
          <a href={`tel:${broker.phone}`} className="profile-card-contact">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            {broker.phone}
          </a>
        )}
        {broker.email && (
          <a href={`mailto:${broker.email}`} className="profile-card-contact">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <path d="M22 6l-10 7L2 6" />
            </svg>
            {broker.email}
          </a>
        )}
      </div>

      {((broker.languages?.length ?? 0) > 0 || (broker.certifications?.length ?? 0) > 0) && (
        <div className="profile-card-tags">
          {broker.languages?.map((lang) => (
            <span key={lang} className="profile-card-tag">{lang}</span>
          ))}
          {broker.certifications?.map((cert) => (
            <span key={cert} className="profile-card-tag profile-card-tag--cert">{cert}</span>
          ))}
        </div>
      )}

      {broker.bio && (
        <div className="profile-card-bio">
          <p>{broker.bio}</p>
        </div>
      )}
    </div>
  );
}

type BrokerStatsCardProps = {
  broker: Broker;
};

export function BrokerStatsCard({ broker }: BrokerStatsCardProps) {
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
          <div className="profile-stat-value">{broker.activeListings.toLocaleString("cs")}</div>
          <div className="profile-stat-label">Aktivnich nabidek</div>
        </div>
        <div className="profile-stat">
          <div className="profile-stat-value">{broker.totalDeals}</div>
          <div className="profile-stat-label">Celkem obchodu</div>
        </div>
        <div className="profile-stat">
          <div className="profile-stat-value">{broker.rating > 0 ? broker.rating : "-"}</div>
          <div className="profile-stat-label">Hodnoceni</div>
        </div>
      </div>
    </div>
  );
}

type BrokerReviewsCardProps = {
  broker: Broker;
  reviews: Review[];
};

export function BrokerReviewsCard({ broker, reviews }: BrokerReviewsCardProps) {
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
            <span className="profile-reviews-avg">{broker.rating}</span>
            <Stars rating={broker.rating} size={18} />
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
