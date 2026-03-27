import Link from "next/link";
import { notFound } from "next/navigation";
import { PropertyCard } from "@/components/property-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { formatPrice, getPropertyBySlug, getSimilarProperties, getBrokerById, getAgencyById } from "@/lib/api";
import { t } from "@/i18n";
import { brand } from "@/brands";
import { DetailMap } from "./detail-map";
import { DetailSplitLayout } from "./detail-split-layout";
import { MediaGallery } from "./media-gallery";
import { PointsOfInterest } from "./points-of-interest";
import { AutoSaveSearch } from "./auto-save-search";
import { TrackView } from "./track-view";
import { TrackDetail } from "./track-detail";
import { TrackPhoneLink, TrackEmailLink, TrackContactButton } from "./track-contact";
import { MortgageCalculator } from "./mortgage-calculator";

function buildAddress(parts: (string | undefined)[]): string {
  const seen = new Set<string>();
  return parts.filter((p): p is string => {
    if (!p) return false;
    const lower = p.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  }).join(", ");
}


type PropertyDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function PropertyDetailPage({ params }: PropertyDetailPageProps) {
  const { slug } = await params;
  const property = await getPropertyBySlug(slug);

  if (!property) {
    notFound();
  }

  const similarProperties = await getSimilarProperties(property.slug, property.city);
  const broker = property.brokerId ? await getBrokerById(property.brokerId) : undefined;
  const agency = broker?.agencyId ? await getAgencyById(broker.agencyId) : undefined;

  // === Parametry ===
  const params_data = [
    { label: t.filters.subtype, value: property.subtype },
    { label: t.filters.rooms, value: property.roomsLabel },
    { label: t.params.area, value: property.area ? `${property.area} m²` : "" },
    ...(property.landArea ? [{ label: t.params.landArea, value: `${property.landArea} m²` }] : []),
    ...(property.builtUpArea ? [{ label: t.params.builtUpArea, value: `${property.builtUpArea} m²` }] : []),
    ...(property.floorArea ? [{ label: t.params.floorArea, value: `${property.floorArea} m²` }] : []),
    ...(property.balconyArea ? [{ label: t.features.balcony, value: `${property.balconyArea} m²` }] : []),
    ...(property.terraceArea ? [{ label: t.features.terrace, value: `${property.terraceArea} m²` }] : []),
    ...(property.gardenArea ? [{ label: t.features.garden, value: `${property.gardenArea} m²` }] : []),
    ...(property.loggiaArea ? [{ label: t.features.loggia, value: `${property.loggiaArea} m²` }] : []),
    ...(property.cellarArea ? [{ label: t.features.cellar, value: `${property.cellarArea} m²` }] : []),
    ...(property.basinArea ? [{ label: t.features.pool, value: `${property.basinArea} m²` }] : []),
    { label: t.filters.city, value: property.city },
    { label: t.detail.district, value: property.district },
    ...(property.cityPart ? [{ label: t.detail.cityPart, value: property.cityPart }] : []),
    ...(property.zip ? [{ label: t.detail.zip, value: property.zip }] : []),
    ...(property.region ? [{ label: t.detail.region, value: property.region }] : []),
    ...(property.country && property.country !== "cz" ? [{ label: t.filters.country, value: t.enumLabels.countries[property.country as keyof typeof t.enumLabels.countries] || property.country.toUpperCase() }] : []),
    { label: t.params.condition, value: property.condition },
    { label: t.params.ownership, value: property.ownership },
    { label: t.params.furnishing, value: property.furnishing },
    { label: t.params.energyRating, value: property.energyRating },
    ...(property.buildingMaterial ? [{ label: t.params.material, value: property.buildingMaterial }] : []),
    ...(property.flooring ? [{ label: t.params.flooring, value: property.flooring }] : []),
    ...(property.heating?.length ? [{ label: t.params.heating, value: property.heating.join(", ") }] : []),
    ...(property.heatingSource?.length ? [{ label: t.params.heatingSource, value: property.heatingSource.join(", ") }] : []),
    ...(property.heatingElement?.length ? [{ label: t.params.heatingElement, value: property.heatingElement.join(", ") }] : []),
    ...(property.waterHeatSource?.length ? [{ label: t.params.waterHeatSource, value: property.waterHeatSource.join(", ") }] : []),
    { label: t.detail.parking, value: property.parking },
    ...(property.parkingSpaces ? [{ label: t.detail.parkingSpaces, value: String(property.parkingSpaces) }] : []),
    ...(property.garageCount ? [{ label: t.features.garage, value: String(property.garageCount) }] : []),
    ...(property.floor ? [{ label: t.detail.floor, value: property.totalFloors ? `${property.floor}/${property.totalFloors}` : String(property.floor) }] : []),
    ...(property.totalFloors && !property.floor ? [{ label: t.detail.totalFloors, value: String(property.totalFloors) }] : []),
    ...(property.undergroundFloors ? [{ label: t.detail.undergroundFloors, value: String(property.undergroundFloors) }] : []),
    ...(property.ceilingHeight ? [{ label: t.detail.ceilingHeight, value: `${property.ceilingHeight} m` }] : []),
    ...(property.yearBuilt ? [{ label: t.detail.yearBuilt, value: String(property.yearBuilt) }] : []),
    ...(property.lastRenovation ? [{ label: t.detail.lastRenovation, value: String(property.lastRenovation) }] : []),
    ...(property.acceptanceYear ? [{ label: t.detail.acceptanceYear, value: String(property.acceptanceYear) }] : []),
    ...(property.objectType ? [{ label: t.params.objectType, value: property.objectType }] : []),
    ...(property.objectKind ? [{ label: t.params.objectKind, value: property.objectKind }] : []),
    ...(property.objectLocation ? [{ label: t.params.objectLocation, value: property.objectLocation }] : []),
    ...(property.flatClass ? [{ label: t.params.flatClass, value: property.flatClass }] : []),
    ...(property.surroundingsType ? [{ label: t.params.surroundings, value: property.surroundingsType }] : []),
    ...(property.protection ? [{ label: t.params.protection, value: property.protection }] : []),
    ...(property.numOwners ? [{ label: t.detail.ownerCount, value: String(property.numOwners) }] : []),
    ...(property.apartmentNumber ? [{ label: t.detail.apartmentNumber, value: String(property.apartmentNumber) }] : []),
    ...(property.shareNumerator && property.shareDenominator ? [{ label: t.detail.share_fraction, value: `${property.shareNumerator}/${property.shareDenominator}` }] : []),
  ];

  // === Vybavení a vlastnosti ===
  const features = [
    property.balcony && t.features.balcony,
    property.terrace && t.features.terrace,
    property.garden && t.features.garden,
    property.elevator && t.features.elevator,
    property.cellar && t.features.cellar,
    property.garage && t.features.garage,
    property.pool && t.features.pool,
    property.loggia && t.features.loggia,
    property.easyAccess && t.features.easyAccess,
    property.lowEnergy && t.features.lowEnergy,
    property.ftvPanels && t.features.ftvPanels,
    property.solarPanels && t.features.solarPanels,
    property.mortgage && t.detail.mortgagePossible,
    property.exclusivelyAtRk && t.detail.exclusiveAtRk,
  ].filter(Boolean);

  // === Inženýrské sítě ===
  const networks = [
    ...(property.electricity?.length ? [{ label: t.params.electricity, value: property.electricity.join(", ") }] : []),
    ...(property.gas?.length ? [{ label: t.params.gas, value: property.gas.join(", ") }] : []),
    ...(property.water?.length ? [{ label: t.params.water, value: property.water.join(", ") }] : []),
    ...(property.gully?.length ? [{ label: t.params.gully, value: property.gully.join(", ") }] : []),
    ...(property.roadType?.length ? [{ label: t.params.roadType, value: property.roadType.join(", ") }] : []),
    ...(property.telecommunication?.length ? [{ label: t.params.telecommunication, value: property.telecommunication.join(", ") }] : []),
    ...(property.transport?.length ? [{ label: t.params.transport, value: property.transport.join(", ") }] : []),
    ...(property.internetConnectionType?.length ? [{ label: t.params.internet, value: property.internetConnectionType.join(", ") }] : []),
    ...(property.internetConnectionProvider ? [{ label: t.detail.internetProvider, value: property.internetConnectionProvider }] : []),
    ...(property.internetConnectionSpeed ? [{ label: t.detail.internetSpeed, value: `${property.internetConnectionSpeed} Mbps` }] : []),
    ...(property.circuitBreaker ? [{ label: t.detail.circuitBreaker, value: property.circuitBreaker }] : []),
    ...(property.phaseDistribution ? [{ label: t.detail.phaseDistribution, value: property.phaseDistribution }] : []),
    ...(property.wellType?.length ? [{ label: t.detail.wellType, value: property.wellType.join(", ") }] : []),
  ];

  // === Finanční info ===
  const financials = [
    ...(property.priceNote ? [{ label: t.detail.priceNote, value: property.priceNote }] : []),
    ...(property.priceUnit ? [{ label: t.detail.priceIs, value: property.priceUnit === "za_mesic" ? t.propertyCard.perMonth.replace("/ ", "") : property.priceUnit === "za_rok" ? t.detail.perYear.replace("/ ", "") : property.priceUnit }] : []),
    ...(property.priceNegotiation ? [{ label: t.filters.price, value: t.detail.priceNegotiable }] : []),
    ...(property.annuity ? [{ label: t.detail.annuity, value: `${property.annuity.toLocaleString(brand.locale)} ${t.enumLabels.priceCurrencies[property.priceCurrency as keyof typeof t.enumLabels.priceCurrencies] || property.priceCurrency}` }] : []),
    ...(property.costOfLiving ? [{ label: t.detail.livingCosts, value: property.costOfLiving }] : []),
    ...(property.commission ? [{ label: t.detail.commissionFee, value: `${property.commission.toLocaleString(brand.locale)} ${t.enumLabels.priceCurrencies[property.priceCurrency as keyof typeof t.enumLabels.priceCurrencies] || property.priceCurrency}` }] : []),
    ...(property.refundableDeposit ? [{ label: t.detail.refundableDeposit, value: `${property.refundableDeposit.toLocaleString(brand.locale)} ${t.enumLabels.priceCurrencies[property.priceCurrency as keyof typeof t.enumLabels.priceCurrencies] || property.priceCurrency}` }] : []),
    ...(property.mortgagePercent ? [{ label: t.detail.mortgagePercent, value: `${property.mortgagePercent} %` }] : []),
    ...(property.sporPercent ? [{ label: t.detail.sporPercent, value: `${property.sporPercent} %` }] : []),
  ];

  // === Pronájem specifické ===
  const rentalInfo = [
    ...(property.leaseType ? [{ label: t.detail.leaseType, value: property.leaseType }] : []),
    ...(property.readyDate ? [{ label: t.detail.moveInDate, value: property.readyDate }] : []),
    ...(property.tenantNotPayCommission ? [{ label: t.detail.tenantNoCommission, value: t.common.yes }] : []),
  ];

  // === Dražba specifické ===
  const auctionInfo = [
    ...(property.auctionKind ? [{ label: t.detail.auctionKind, value: property.auctionKind }] : []),
    ...(property.auctionDate ? [{ label: t.detail.auctionDate, value: property.auctionDate }] : []),
    ...(property.auctionPlace ? [{ label: t.detail.auctionPlace, value: property.auctionPlace }] : []),
    ...(property.priceAuctionPrincipal ? [{ label: t.detail.auctionDeposit, value: `${property.priceAuctionPrincipal.toLocaleString(brand.locale)} ${t.enumLabels.priceCurrencies[property.priceCurrency as keyof typeof t.enumLabels.priceCurrencies] || property.priceCurrency}` }] : []),
    ...(property.priceExpertReport ? [{ label: t.detail.expertReport, value: `${property.priceExpertReport.toLocaleString(brand.locale)} ${t.enumLabels.priceCurrencies[property.priceCurrency as keyof typeof t.enumLabels.priceCurrencies] || property.priceCurrency}` }] : []),
    ...(property.priceMinimumBid ? [{ label: t.detail.minimumBid, value: `${property.priceMinimumBid.toLocaleString(brand.locale)} ${t.enumLabels.priceCurrencies[property.priceCurrency as keyof typeof t.enumLabels.priceCurrencies] || property.priceCurrency}` }] : []),
  ];

  // === Termíny ===
  const dates = [
    ...(property.beginningDate ? [{ label: t.detail.constructionStart, value: property.beginningDate }] : []),
    ...(property.finishDate ? [{ label: t.detail.completionDate, value: property.finishDate }] : []),
    ...(property.saleDate ? [{ label: t.detail.saleDate, value: property.saleDate }] : []),
    ...(property.firstTourDate ? [{ label: t.detail.firstTour, value: property.firstTourDate }] : []),
  ];

  return (
    <div className="page-shell">
      <SiteHeader />
      <AutoSaveSearch />
      <TrackView propertyId={property.id} />
      <TrackDetail
        propertyId={property.id}
        propertySlug={property.slug}
        city={property.city}
        category={property.category}
        listingType={property.listingType}
        price={property.price}
      />
      <main className="detail-page">
        <DetailSplitLayout
          properties={[property, ...similarProperties]}
          selectedPropertyId={property.id}
        >
        <div className="detail-split-content">
          <div className="detail-top-nav">
            <Link href="/nabidky" className="detail-back">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              <span>{t.detail.backToListings}</span>
            </Link>
          </div>

          <MediaGallery
            images={property.images.length > 0 ? property.images : [property.imageSrc]}
            alt={property.imageAlt}
            videoUrl={property.videoUrl}
            matterportUrl={property.matterportUrl}
          />

          <div className="detail-header">
            <div>
              <span
                className="detail-listing-badge"
                style={{ backgroundColor: property.listingType === "sale" ? "var(--badge-sale)" : "var(--badge-rent)" }}
              >
                {t.enumLabels.listingTypes[property.listingType as keyof typeof t.enumLabels.listingTypes] || property.listingType}
              </span>
              <h1 className="detail-title">{property.title}</h1>
              <div className="detail-location">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {buildAddress([property.street, property.district, property.city, property.country && property.country !== "cz" ? t.enumLabels.countries[property.country as keyof typeof t.enumLabels.countries] || property.country.toUpperCase() : undefined])}
              </div>
            </div>
            <div className="detail-price">
              {formatPrice(property.price, property.priceCurrency)}
              {property.priceUnit && (
                <span style={{ fontSize: "0.5em", fontWeight: 400, color: "var(--text-muted)", marginLeft: 4 }}>
                  {property.priceUnit === "za_mesic" ? t.propertyCard.perMonth : property.priceUnit === "za_rok" ? t.detail.perYear : `/ ${property.priceUnit}`}
                </span>
              )}
            </div>
          </div>

          <div className="detail-grid">
            <div>
              <div className="detail-section">
                <h2 className="detail-section-title">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                  </svg>
                  {t.detail.description}
                </h2>
                <p className="detail-description" style={{ whiteSpace: "pre-line" }}>{property.description || property.summary}</p>
              </div>

              <div className="detail-section">
                <h2 className="detail-section-title">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                  </svg>
                  {t.detail.parameters}
                </h2>
                <div className="detail-params-grid">
                  {params_data.map((param) => (
                    <div key={param.label} className="detail-param">
                      <span className="detail-param-label">{param.label}</span>
                      <span className="detail-param-value">{param.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {features.length > 0 && (
                <div className="detail-section">
                  <h2 className="detail-section-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <path d="M22 4L12 14.01l-3-3" />
                    </svg>
                    {t.detail.equipment}
                  </h2>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {features.map((f) => (
                      <span
                        key={f as string}
                        style={{
                          padding: "6px 14px",
                          borderRadius: 8,
                          fontSize: "0.85rem",
                          fontWeight: 500,
                          background: "var(--bg-filter)",
                          color: "var(--text-secondary)",
                          border: "1px solid var(--border-light)",
                        }}
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {networks.length > 0 && (
                <div className="detail-section">
                  <h2 className="detail-section-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10" />
                    </svg>
                    {t.detail.infrastructure}
                  </h2>
                  <div className="detail-params-grid">
                    {networks.map((param) => (
                      <div key={param.label} className="detail-param">
                        <span className="detail-param-label">{param.label}</span>
                        <span className="detail-param-value">{param.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {financials.length > 0 && (
                <div className="detail-section">
                  <h2 className="detail-section-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                    {t.detail.financialInfo}
                  </h2>
                  <div className="detail-params-grid">
                    {financials.map((param) => (
                      <div key={param.label} className="detail-param">
                        <span className="detail-param-label">{param.label}</span>
                        <span className="detail-param-value">{param.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {rentalInfo.length > 0 && (
                <div className="detail-section">
                  <h2 className="detail-section-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                    {t.listingTypes.rent}
                  </h2>
                  <div className="detail-params-grid">
                    {rentalInfo.map((param) => (
                      <div key={param.label} className="detail-param">
                        <span className="detail-param-label">{param.label}</span>
                        <span className="detail-param-value">{param.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {auctionInfo.length > 0 && (
                <div className="detail-section">
                  <h2 className="detail-section-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                    </svg>
                    {t.listingTypes.auction}
                  </h2>
                  <div className="detail-params-grid">
                    {auctionInfo.map((param) => (
                      <div key={param.label} className="detail-param">
                        <span className="detail-param-label">{param.label}</span>
                        <span className="detail-param-value">{param.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {dates.length > 0 && (
                <div className="detail-section">
                  <h2 className="detail-section-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    {t.detail.dates}
                  </h2>
                  <div className="detail-params-grid">
                    {dates.map((param) => (
                      <div key={param.label} className="detail-param">
                        <span className="detail-param-label">{param.label}</span>
                        <span className="detail-param-value">{param.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {property.keywords && property.keywords.length > 0 && (
                <div className="detail-section">
                  <h2 className="detail-section-title">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" /><line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" />
                    </svg>
                    {t.detail.keywords}
                  </h2>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {property.keywords.map((kw) => (
                      <span
                        key={kw}
                        style={{
                          padding: "4px 12px",
                          borderRadius: 6,
                          fontSize: "0.8rem",
                          background: "var(--bg-filter)",
                          color: "var(--text-muted)",
                          border: "1px solid var(--border-light)",
                        }}
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {property.pointsOfInterest && property.pointsOfInterest.length > 0 && (
                <PointsOfInterest items={property.pointsOfInterest} />
              )}
            </div>

            <aside>
              <div className="detail-sidebar-card">
                <h3 className="detail-section-title" style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
                  {t.detail.broker}
                </h3>
                <div className="broker-card-header">
                  <div className="broker-avatar" style={{ overflow: "hidden", flexShrink: 0 }}>
                    {broker?.photo ? (
                      <img src={broker.photo} alt={property.brokerName} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                    ) : (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <div className="broker-name">{property.brokerName}</div>
                    {agency ? (
                      <Link href={`/kancelare/${agency.slug}`} className="broker-agency" style={{ textDecoration: "none" }}>
                        {property.agencyName}
                      </Link>
                    ) : (
                      <div className="broker-agency">{property.agencyName}</div>
                    )}
                  </div>
                </div>
                {property.brokerPhone && (
                  <div className="broker-contact-row">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                    <TrackPhoneLink phone={property.brokerPhone} propertyId={property.id}>{property.brokerPhone}</TrackPhoneLink>
                  </div>
                )}
                {property.brokerEmail && (
                  <div className="broker-contact-row">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <path d="M22 6l-10 7L2 6" />
                    </svg>
                    <TrackEmailLink email={property.brokerEmail} propertyId={property.id}>{property.brokerEmail}</TrackEmailLink>
                  </div>
                )}
                <div style={{ marginTop: 16 }}>
                  <TrackContactButton propertyId={property.id} label={t.detail.contactBroker} />
                  {broker ? (
                    <Link href={`/makleri/${broker.slug}`} className="detail-cta-btn detail-cta-btn--secondary" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
                      {t.detail.viewBrokerProfile}
                    </Link>
                  ) : (
                    <button className="detail-cta-btn detail-cta-btn--secondary">
                      {t.detail.viewBrokerProfile}
                    </button>
                  )}
                </div>
              </div>

              {agency && (
                <div className="detail-sidebar-card">
                  <h3 className="detail-section-title" style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
                    {t.detail.agency}
                  </h3>
                  <Link href={`/kancelare/${agency.slug}`} style={{ textDecoration: "none", display: "block" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                      <div style={{ width: 56, height: 56, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                        {agency.logo ? (
                          <img src={agency.logo} alt={agency.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                        ) : (
                          <div style={{ width: 56, height: 56, borderRadius: 12, background: "var(--bg-filter)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                              <path d="M3 21h18M3 7v14M21 7v14M6 11h4M6 15h4M14 11h4M14 15h4M9 21v-4h6v4M12 3l9 4H3l9-4z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: "var(--text)", fontSize: "1rem" }}>{agency.name}</div>
                        {agency.specializations.length > 0 && (
                          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 2 }}>
                            {agency.specializations.slice(0, 2).join(", ")}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                  {agency.phone && (
                    <div className="broker-contact-row">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                      <a href={`tel:${agency.phone}`} style={{ color: "inherit", textDecoration: "none" }}>{agency.phone}</a>
                    </div>
                  )}
                  {agency.email && (
                    <div className="broker-contact-row">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <path d="M22 6l-10 7L2 6" />
                      </svg>
                      <a href={`mailto:${agency.email}`} style={{ color: "inherit", textDecoration: "none" }}>{agency.email}</a>
                    </div>
                  )}
                  {agency.website && (
                    <div className="broker-contact-row">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                      </svg>
                      <a href={agency.website} target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "none" }}>
                        {agency.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                      </a>
                    </div>
                  )}
                  <div style={{ marginTop: 12 }}>
                    <Link href={`/kancelare/${agency.slug}`} className="detail-cta-btn detail-cta-btn--secondary" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
                      {t.detail.viewAgencyProfile}
                    </Link>
                  </div>
                </div>
              )}

              {property.listingType === "sale" && (
                <MortgageCalculator propertyPrice={property.price} priceCurrency={property.priceCurrency} />
              )}

              <div className="detail-sidebar-card">
                <h3 className="detail-section-title" style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
                  {t.detail.locality}
                </h3>
                <div style={{ color: "var(--text)", fontWeight: 600, marginBottom: 4 }}>
                  {buildAddress([property.street, property.district, property.city, property.country && property.country !== "cz" ? t.enumLabels.countries[property.country as keyof typeof t.enumLabels.countries] || property.country.toUpperCase() : undefined])}
                </div>
                <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: 16 }}>
                  {property.latitude.toFixed(4)}, {property.longitude.toFixed(4)}
                </div>
                <DetailMap
                  latitude={property.latitude}
                  longitude={property.longitude}
                  title={property.title}
                  price={property.price}
                />
              </div>
            </aside>
          </div>

          {similarProperties.length > 0 && (
            <section className="similar-section">
              <h2 className="section-title">{t.detail.similarProperties}</h2>
              <div className="similar-grid">
                {similarProperties.map((item) => (
                  <PropertyCard key={item.id} property={item} />
                ))}
              </div>
            </section>
          )}
        </div>
        <SiteFooter />
        </DetailSplitLayout>
      </main>
    </div>
  );
}
