import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { BrokerAboutCard, BrokerStatsCard, BrokerReviewsCard } from "@/components/broker-profile-cards";
import { DetailTabs } from "@/components/detail-tabs";
import { DetailPropertiesGrid } from "@/components/detail-properties-grid";
import {
  getBrokerBySlug,
  getBrokerReviews,
  getAgencyById,
  getAgencyBranches,
  getBrokerPropertiesPaginated,
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

  const [reviewsList, agency, agencyBranches, propertiesPage1] = await Promise.all([
    getBrokerReviews(broker.id),
    getAgencyById(broker.agencyId),
    broker.agencyId ? getAgencyBranches(broker.agencyId) : Promise.resolve([]),
    getBrokerPropertiesPaginated(broker.id, 1, 24),
  ]);

  const hqBranch = agencyBranches.find((b) => b.isHeadquarters) ?? agencyBranches[0] ?? null;
  const agencyAddress = hqBranch
    ? `${hqBranch.address}, ${hqBranch.city}`
    : agency
      ? [agency.seatAddress, agency.seatCity].filter(Boolean).join(", ") || undefined
      : undefined;

  const tabs = [
    {
      id: "nabidky",
      label: "Nabidky",
      count: propertiesPage1.total,
      content: (
        <DetailPropertiesGrid
          brokerId={broker.id}
          initialItems={propertiesPage1.items}
          initialTotal={propertiesPage1.total}
        />
      ),
    },
  ];

  return (
    <div className="page-shell">
      <SiteHeader />
      <main className="detail-page">
        <div className="profile-cards-grid">
          <BrokerAboutCard broker={broker} agency={agency} agencyAddress={agencyAddress} />
          <BrokerStatsCard broker={broker} />
          <BrokerReviewsCard broker={broker} reviews={reviewsList} />
        </div>
        <DetailTabs tabs={tabs} defaultTab="nabidky" />
      </main>
      <SiteFooter />
    </div>
  );
}
