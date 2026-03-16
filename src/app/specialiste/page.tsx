import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SpecialistsContent } from "@/components/specialists-content";
import {
  getBrokers,
  getAgencies,
  getAllLocationCities,
  getAllSpecializations,
  getBrokerCitiesMap,
  getBranchCitiesMap,
} from "@/lib/api";

export default async function SpecialistePage() {
  const [allBrokers, allAgencies, cities, specs, brokerCitiesMap, branchCitiesMap] =
    await Promise.all([
      getBrokers(),
      getAgencies(),
      getAllLocationCities(),
      getAllSpecializations(),
      getBrokerCitiesMap(),
      getBranchCitiesMap(),
    ]);

  return (
    <div className="page-shell">
      <SiteHeader />
      <main style={{ paddingTop: 96, minHeight: "100vh", background: "var(--bg)" }}>
        <div className="container">
          <h1 className="section-title" style={{ fontSize: "2rem", marginBottom: 8 }}>
            Najdete specialistu
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "1rem", marginBottom: 24, maxWidth: 600 }}>
            Vyhledejte maklere nebo kancelar podle lokality a zamereni.
          </p>
          <SpecialistsContent
            allBrokers={allBrokers}
            allAgencies={allAgencies}
            cities={cities}
            specs={specs}
            brokerCitiesMap={brokerCitiesMap}
            branchCitiesMap={branchCitiesMap}
          />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
