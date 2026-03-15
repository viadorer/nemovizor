import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ProfileToggle } from "@/components/profile-toggle";
import type { ProfileMode } from "@/components/profile-toggle";
import { ListingsContent } from "@/components/listings-content";
import {
  AgencyAboutCard,
  AgencyStatsCard,
  AgencyReviewsCard,
  AgencyBrokersGrid,
  AgencyBranchesGrid,
} from "@/components/agency-profile-cards";
import {
  BrokerAboutCard,
} from "@/components/broker-profile-cards";
import {
  getAgencyBySlug,
  getAgencyBrokers,
  getAgencyBranches,
  getAgencyReviews,
  getAgencyById,
} from "@/lib/api";

type AgencyDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function AgencyDetailPage({ params }: AgencyDetailPageProps) {
  const { slug } = await params;
  const agency = await getAgencyBySlug(slug);

  if (!agency) {
    notFound();
  }

  const [agencyBrokers, agencyBranches, reviewsList, parentAgency] = await Promise.all([
    getAgencyBrokers(agency.id),
    getAgencyBranches(agency.id),
    getAgencyReviews(agency.id),
    agency.parentAgencyId ? getAgencyById(agency.parentAgencyId) : Promise.resolve(null),
  ]);

  // If only 1 broker, show them in the profile cards section instead of a tab
  const singleBroker = agencyBrokers.length === 1 ? agencyBrokers[0] : null;
  // If only 1 branch, don't show branches tab (info is in the about card area)
  const showBranchesTab = agencyBranches.length > 1;
  const showBrokersTab = agencyBrokers.length > 1;

  // Build dynamic tabs for the split view section
  const modes: ProfileMode[] = [];

  if (showBranchesTab) {
    modes.push({
      id: "pobocky",
      label: "Pobocky",
      count: agencyBranches.length,
      content: (
        <div className="profile-cards-section">
          <AgencyBranchesGrid branches={agencyBranches} />
        </div>
      ),
    });
  }

  if (showBrokersTab) {
    modes.push({
      id: "makleri",
      label: "Makleri",
      count: agencyBrokers.length,
      content: (
        <div className="profile-cards-section">
          <AgencyBrokersGrid brokers={agencyBrokers} />
        </div>
      ),
    });
  }

  modes.push({
    id: "nabidky",
    label: "Nabidky",
    count: agency.totalListings,
    content: <ListingsContent agencyId={agency.id} embedded />,
  });

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
              Zpet na kancelare
            </Link>
          </div>
        </div>

        {/* Profile cards — always visible */}
        <div className="profile-cards-section">
          <div className={singleBroker ? "profile-cards-grid profile-cards-grid--4" : "profile-cards-grid"}>
            <AgencyAboutCard agency={agency} parentAgency={parentAgency} />
            <AgencyStatsCard agency={agency} />
            <AgencyReviewsCard agency={agency} reviews={reviewsList} />
            {singleBroker && (
              <BrokerAboutCard broker={singleBroker} agency={null} />
            )}
          </div>
        </div>

        {/* Tabs + split view */}
        <ProfileToggle modes={modes} defaultMode="nabidky" />
      </main>
      <SiteFooter />
    </div>
  );
}
