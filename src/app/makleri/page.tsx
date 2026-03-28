import { t } from "@/i18n";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { AgentDirectoryClient } from "@/components/agent-directory";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function getInitialData() {
  const client = getSupabase();
  if (!client) return { brokers: [], agencies: [], total: 0 };

  // Brokers with agency info
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: brokersRaw } = await (client as any)
    .from("brokers")
    .select("id, name, slug, photo, phone, email, specialization, languages, rating, active_listings, total_deals, year_started, agency_id, is_promoted, agencies(id, name, slug, logo)")
    .eq("active", true)
    .order("is_promoted", { ascending: false })
    .order("rating", { ascending: false })
    .limit(60);

  // Agencies
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: agenciesRaw } = await (client as any)
    .from("agencies")
    .select("id, name, slug, logo, description, phone, email, website, seat_city, rating, specializations, total_brokers, total_listings")
    .eq("active", true)
    .order("rating", { ascending: false })
    .limit(60);

  return {
    brokers: (brokersRaw || []).map((b: Record<string, unknown>) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      photo: b.photo || "",
      phone: b.phone || "",
      email: b.email || "",
      specialization: b.specialization || "",
      languages: b.languages || [],
      rating: Number(b.rating) || 0,
      activeListings: Number(b.active_listings) || 0,
      totalDeals: Number(b.total_deals) || 0,
      yearStarted: b.year_started ? Number(b.year_started) : undefined,
      isPromoted: Boolean(b.is_promoted),
      agencyName: (b.agencies as Record<string, unknown>)?.name || "",
      agencySlug: (b.agencies as Record<string, unknown>)?.slug || "",
      agencyLogo: (b.agencies as Record<string, unknown>)?.logo || "",
    })),
    agencies: (agenciesRaw || []).map((a: Record<string, unknown>) => ({
      id: a.id,
      name: a.name,
      slug: a.slug,
      logo: a.logo || "",
      description: String(a.description || "").slice(0, 200),
      seatCity: a.seat_city || "",
      rating: Number(a.rating) || 0,
      specializations: a.specializations || [],
      totalBrokers: Number(a.total_brokers) || 0,
      totalListings: Number(a.total_listings) || 0,
    })),
    total: (brokersRaw || []).length,
  };
}

export default async function AgentDirectoryPage() {
  const data = await getInitialData();

  return (
    <div className="page-shell">
      <SiteHeader />
      <AgentDirectoryClient initialData={data} />
      <SiteFooter />
    </div>
  );
}
