import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ListingsContent } from "@/components/listings-content";
import {
  BrokerAboutCard,
  BrokerStatsCard,
  BrokerReviewsCard,
} from "@/components/broker-profile-cards";
import {
  getBrokerBySlug,
  getBrokerReviews,
  getAgencyById,
} from "@/lib/api";

type BrokerDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function BrokerDetailPage({ params }: BrokerDetailPageProps) {
  const { slug } = await params;
  const broker = await getBrokerBySlug(slug);

  if (!broker) {
    notFound();
  }

  const [reviewsList, agency] = await Promise.all([
    getBrokerReviews(broker.id),
    getAgencyById(broker.agencyId),
  ]);

  return (
    <div className="page-shell">
      <SiteHeader />
      <main className="profile-detail-page">
        {/* Back link */}
        <div className="profile-topbar">
          <div className="profile-topbar-inner">
            <Link href="/makleri" className="profile-back-link">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Zpet na maklere
            </Link>
          </div>
        </div>

        {/* Profile cards — always visible */}
        <div className="profile-cards-section">
          <div className="profile-cards-grid">
            <BrokerAboutCard broker={broker} agency={agency} />
            <BrokerStatsCard broker={broker} />
            <BrokerReviewsCard broker={broker} reviews={reviewsList} />
          </div>
        </div>

        {/* Tab bar — single "Nabidky" tab for broker */}
        <div className="profile-toggle-bar">
          <div className="profile-toggle-buttons">
            <button className="profile-toggle-btn profile-toggle-btn--active">
              Nabidky
              {broker.activeListings > 0 && (
                <span className="profile-toggle-count">{broker.activeListings.toLocaleString("cs")}</span>
              )}
            </button>
          </div>
        </div>

        {/* Split view: listings + map */}
        <Suspense
          fallback={
            <div style={{ height: "60vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
              Nacitani nabidek...
            </div>
          }
        >
          <ListingsContent brokerId={broker.id} embedded />
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  );
}
