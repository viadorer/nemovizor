import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { BrokerProfileHeader } from "@/components/profile-header";
import { DetailTabs } from "@/components/detail-tabs";
import { DetailPropertiesGrid } from "@/components/detail-properties-grid";
import {
  getBrokerBySlug,
  getBrokerReviews,
  getAgencyById,
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

  const [reviewsList, agency, propertiesPage1] = await Promise.all([
    getBrokerReviews(broker.id),
    getAgencyById(broker.agencyId),
    getBrokerPropertiesPaginated(broker.id, 1, 24),
  ]);

  const profileHeader = (
    <BrokerProfileHeader broker={broker} agency={agency} reviews={reviewsList} />
  );

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
        <DetailTabs tabs={tabs} defaultTab="nabidky" headerContent={profileHeader} />
      </main>
      <SiteFooter />
    </div>
  );
}
