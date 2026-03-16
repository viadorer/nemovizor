import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { AgencyAboutCard, AgencyStatsCard, AgencyReviewsCard, AgencyBrokersGrid, AgencyBranchesGrid } from "@/components/agency-profile-cards";
import { DetailTabs } from "@/components/detail-tabs";
import type { DetailTab } from "@/components/detail-tabs";
import { DetailPropertiesGrid } from "@/components/detail-properties-grid";
import {
  getAgencyBySlug,
  getAgencyBrokers,
  getAgencyBranches,
  getAgencyReviews,
  getAgencyById,
  getAgencyPropertiesPaginated,
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

  const [agencyBrokers, agencyBranches, reviewsList, parentAgency, propertiesPage1] = await Promise.all([
    getAgencyBrokers(agency.id),
    getAgencyBranches(agency.id),
    getAgencyReviews(agency.id),
    agency.parentAgencyId ? getAgencyById(agency.parentAgencyId) : Promise.resolve(null),
    getAgencyPropertiesPaginated(agency.id, 1, 24),
  ]);

  const hqBranch = agencyBranches.find((b) => b.isHeadquarters) ?? agencyBranches[0] ?? null;
  const agencyAddress = hqBranch
    ? `${hqBranch.address}, ${hqBranch.city}`
    : [agency.seatAddress, agency.seatCity].filter(Boolean).join(", ") || undefined;

  const tabs: DetailTab[] = [];

  if (agencyBranches.length > 1) {
    tabs.push({
      id: "pobocky",
      label: "Pobocky",
      count: agencyBranches.length,
      content: (
        <div className="detail-cards-grid detail-cards-grid--profile">
          <AgencyBranchesGrid branches={agencyBranches} />
        </div>
      ),
    });
  }

  tabs.push({
    id: "makleri",
    label: "Makleri",
    count: agencyBrokers.length,
    content: (
      <div className="detail-cards-grid detail-cards-grid--brokers">
        <AgencyBrokersGrid brokers={agencyBrokers} agencyAddress={agencyAddress} />
      </div>
    ),
  });

  tabs.push({
    id: "nabidky",
    label: "Nabidky",
    count: propertiesPage1.total,
    content: (
      <DetailPropertiesGrid
        agencyId={agency.id}
        initialItems={propertiesPage1.items}
        initialTotal={propertiesPage1.total}
      />
    ),
  });

  return (
    <div className="page-shell">
      <SiteHeader />
      <main className="detail-page">
        <div className="profile-cards-grid">
          <AgencyAboutCard agency={agency} parentAgency={parentAgency} hqBranch={hqBranch} />
          <AgencyStatsCard agency={agency} />
          <AgencyReviewsCard agency={agency} reviews={reviewsList} />
        </div>
        <DetailTabs tabs={tabs} defaultTab="nabidky" />
      </main>
      <SiteFooter />
    </div>
  );
}
