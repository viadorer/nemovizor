"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import {
  ListingTypes,
  PropertyCategories,
  PropertyConditions,
  BuildingMaterials,
  OwnershipTypes,
  FurnishingTypes,
  EnergyRatings,
  ParkingTypes,
  ObjectTypes,
  ObjectKinds,
  ObjectLocations,
  FlatClasses,
  HeatingTypes,
  HeatingElements,
  HeatingSources,
  WaterHeatSources,
  ElectricityTypes,
  GasTypes,
  WaterTypes,
  GullyTypes,
  RoadTypes,
  TelecommunicationTypes,
  TransportTypes,
  SurroundingsTypes,
  ProtectionTypes,
  CircuitBreakers,
  InternetConnectionTypes,
  WellTypes,
  AuctionKinds,
  LeaseTypes,
  PriceCurrencies,
  PriceUnits,
  ExtraInfoStatuses,
  EasyAccessTypes,
  PersonalTransferTypes,
  PhaseDistributions,
} from "@/lib/types";
import { PropertyFormData, EMPTY_FORM, SUBTYPE_MAP, slugify } from "./property-form-types";
import { SelectField, TextField, NumberField, CheckboxField, MultiSelectField, TextareaField, TagsField } from "./form-fields";
import { AccordionSection } from "./accordion-section";
import { AddressAutocomplete, MapySuggestion } from "./address-autocomplete";
import { ImageDropZone } from "./image-dropzone";
import { LivePreview } from "./live-preview";
import { useT } from "@/i18n/provider";

// ===== MAIN COMPONENT =====

type PropertyFormProps = {
  mode: "create" | "edit";
  propertyId?: string;
  /** When true, auto-assigns broker_id from logged-in user and hides broker selector */
  brokerMode?: boolean;
  /** Override redirect after save (default: /dashboard/sprava/nemovitosti) */
  redirectTo?: string;
};

export function PropertyForm({ mode, propertyId, brokerMode, redirectTo }: PropertyFormProps) {
  const router = useRouter();
  const t = useT();
  const [form, setForm] = useState<PropertyFormData>({ ...EMPTY_FORM });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [brokers, setBrokers] = useState<{ id: string; name: string }[]>([]);
  /** In broker mode: filtered list of brokers from same agency (if any) */
  const [agencyBrokers, setAgencyBrokers] = useState<{ id: string; name: string }[] | null>(null);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

  // Accordion state: sections 1-3 open by default, 4-5 collapsed
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(["basic", "location", "media"])
  );

  function toggleSection(key: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  // Load property data for edit mode
  useEffect(() => {
    if (mode === "edit" && propertyId) {
      setLoading(true);
      fetch(`/api/${brokerMode ? "broker" : "admin"}/properties?id=${propertyId}`)
        .then((r) => r.json())
        .then((res) => {
          if (res.data) {
            const d = res.data;
            setForm({
              slug: d.slug ?? "",
              title: d.title ?? "",
              listing_type: d.listing_type ?? "sale",
              category: d.category ?? "apartment",
              subtype: d.subtype ?? "",
              rooms_label: d.rooms_label ?? "",
              price: d.price ?? 0,
              price_note: d.price_note ?? "",
              price_currency: d.price_currency ?? "",
              price_unit: d.price_unit ?? "",
              price_negotiation: d.price_negotiation ?? false,
              city: d.city ?? "",
              district: d.district ?? "",
              street: d.street ?? "",
              zip: d.zip ?? "",
              region: d.region ?? "",
              city_part: d.city_part ?? "",
              location_label: d.location_label ?? "",
              latitude: d.latitude ?? 0,
              longitude: d.longitude ?? 0,
              area: d.area ?? 0,
              land_area: d.land_area ?? null,
              built_up_area: d.built_up_area ?? null,
              floor_area: d.floor_area ?? null,
              balcony_area: d.balcony_area ?? null,
              basin_area: d.basin_area ?? null,
              cellar_area: d.cellar_area ?? null,
              garden_area: d.garden_area ?? null,
              loggia_area: d.loggia_area ?? null,
              terrace_area: d.terrace_area ?? null,
              nolive_total_area: d.nolive_total_area ?? null,
              offices_area: d.offices_area ?? null,
              production_area: d.production_area ?? null,
              shop_area: d.shop_area ?? null,
              store_area: d.store_area ?? null,
              workshop_area: d.workshop_area ?? null,
              summary: d.summary ?? "",
              description: d.description ?? "",
              condition: d.condition ?? "",
              ownership: d.ownership ?? "",
              furnishing: d.furnishing ?? "",
              energy_rating: d.energy_rating ?? "",
              building_material: d.building_material ?? "",
              flooring: d.flooring ?? "",
              object_type: d.object_type ?? "",
              object_kind: d.object_kind ?? "",
              object_location: d.object_location ?? "",
              flat_class: d.flat_class ?? "",
              floor: d.floor ?? null,
              total_floors: d.total_floors ?? null,
              underground_floors: d.underground_floors ?? null,
              ceiling_height: d.ceiling_height ?? null,
              parking: d.parking ?? "",
              parking_spaces: d.parking_spaces ?? null,
              garage_count: d.garage_count ?? null,
              balcony: d.balcony ?? false,
              terrace: d.terrace ?? false,
              garden: d.garden ?? false,
              elevator: d.elevator ?? false,
              cellar: d.cellar ?? false,
              garage: d.garage ?? false,
              pool: d.pool ?? false,
              loggia: d.loggia ?? false,
              easy_access: d.easy_access ?? "",
              low_energy: d.low_energy ?? false,
              ftv_panels: d.ftv_panels ?? false,
              solar_panels: d.solar_panels ?? false,
              mortgage: d.mortgage ?? false,
              heating: d.heating ?? [],
              heating_element: d.heating_element ?? [],
              heating_source: d.heating_source ?? [],
              water_heat_source: d.water_heat_source ?? [],
              electricity: d.electricity ?? [],
              gas: d.gas ?? [],
              water: d.water ?? [],
              gully: d.gully ?? [],
              road_type: d.road_type ?? [],
              telecommunication: d.telecommunication ?? [],
              transport: d.transport ?? [],
              internet_connection_type: d.internet_connection_type ?? [],
              internet_connection_provider: d.internet_connection_provider ?? "",
              internet_connection_speed: d.internet_connection_speed ?? null,
              surroundings_type: d.surroundings_type ?? "",
              protection: d.protection ?? "",
              circuit_breaker: d.circuit_breaker ?? "",
              phase_distribution: d.phase_distribution ?? "",
              well_type: d.well_type ?? [],
              annuity: d.annuity ?? null,
              cost_of_living: d.cost_of_living ?? "",
              commission: d.commission ?? null,
              mortgage_percent: d.mortgage_percent ?? null,
              spor_percent: d.spor_percent ?? null,
              refundable_deposit: d.refundable_deposit ?? null,
              lease_type: d.lease_type ?? "",
              tenant_not_pay_commission: d.tenant_not_pay_commission ?? false,
              ready_date: d.ready_date ?? "",
              auction_kind: d.auction_kind ?? "",
              auction_date: d.auction_date ?? "",
              auction_place: d.auction_place ?? "",
              price_auction_principal: d.price_auction_principal ?? null,
              price_expert_report: d.price_expert_report ?? null,
              price_minimum_bid: d.price_minimum_bid ?? null,
              share_numerator: d.share_numerator ?? null,
              share_denominator: d.share_denominator ?? null,
              year_built: d.year_built ?? null,
              last_renovation: d.last_renovation ?? null,
              acceptance_year: d.acceptance_year ?? null,
              beginning_date: d.beginning_date ?? "",
              finish_date: d.finish_date ?? "",
              sale_date: d.sale_date ?? "",
              first_tour_date: d.first_tour_date ?? "",
              extra_info: d.extra_info ?? "",
              exclusively_at_rk: d.exclusively_at_rk ?? false,
              personal_transfer: d.personal_transfer ?? "",
              num_owners: d.num_owners ?? null,
              apartment_number: d.apartment_number ?? null,
              keywords: d.keywords ?? [],
              matterport_url: d.matterport_url ?? "",
              mapy_panorama_url: d.mapy_panorama_url ?? "",
              image_src: d.image_src ?? "",
              image_alt: d.image_alt ?? "",
              images: d.images ?? [],
              broker_id: d.broker_id ?? "",
              project_id: d.project_id ?? "",
              featured: d.featured ?? false,
              active: d.active ?? true,
            });
          }
        })
        .catch(() => setError(t.admin.propertyLoadError))
        .finally(() => setLoading(false));
    }
  }, [mode, propertyId]);

  // Load brokers and projects
  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;

    supabase
      .from("brokers")
      .select("id, name")
      .order("name")
      .limit(500)
      .then(({ data }) => {
        if (data) setBrokers(data as { id: string; name: string }[]);
      });

    supabase
      .from("projects")
      .select("id, name")
      .order("name")
      .limit(200)
      .then(({ data }) => {
        if (data) setProjects(data as { id: string; name: string }[]);
      });
  }, []);

  // In broker mode: detect logged-in user's broker/agency and load team brokers
  useEffect(() => {
    if (!brokerMode) return;
    const supabase = getBrowserSupabase();
    if (!supabase) return;

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;

      // 1) Check if user is a broker
      const { data: myBroker } = await supabase
        .from("brokers")
        .select("id, name, agency_id")
        .eq("user_id", user.id)
        .single();

      // 2) Check if user is an agency owner
      const { data: myAgency } = await supabase
        .from("agencies")
        .select("id")
        .eq("user_id", user.id)
        .single();

      const agencyId = myAgency?.id || myBroker?.agency_id || null;

      // Pre-select broker_id for create mode
      if (mode === "create" && myBroker) {
        setForm((prev) => ({ ...prev, broker_id: prev.broker_id || myBroker.id }));
      }

      // 3) If agency found, load all brokers in that agency
      if (agencyId) {
        const { data: teamBrokers } = await supabase
          .from("brokers")
          .select("id, name")
          .eq("agency_id", agencyId)
          .order("name");

        if (teamBrokers && teamBrokers.length > 1) {
          setAgencyBrokers(teamBrokers as { id: string; name: string }[]);
        } else {
          // Only one broker (self) — no need for selector
          setAgencyBrokers(null);
        }
      }
    });
  }, [brokerMode, mode]);

  // Update field helper
  const set = useCallback(
    <K extends keyof PropertyFormData>(key: K, value: PropertyFormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  // Auto-generate slug from title
  const autoSlug = useCallback(() => {
    if (form.title) {
      set("slug", slugify(form.title));
    }
  }, [form.title, set]);

  // Auto-generate location_label
  useEffect(() => {
    const parts = [form.street, form.city_part, form.city, form.district].filter(Boolean);
    if (parts.length > 0) {
      set("location_label", parts.join(", "));
    }
  }, [form.street, form.city_part, form.city, form.district, set]);

  // Subtypes for current category
  const currentSubtypes = useMemo(() => {
    return SUBTYPE_MAP[form.category] ?? {};
  }, [form.category]);

  // Parse mapy.cz suggestion
  function handleAddressSelect(s: MapySuggestion) {
    const regionMap: Record<string, (v: string) => void> = {
      "regional.municipality": (v) => set("city", v),
      "regional.municipality_part": (v) => set("city_part", v),
      "regional.street": (v) => set("street", v),
      "regional.region": (v) => set("region", v),
      "regional.district": (v) => set("district", v),
    };

    if (s.regionalStructure) {
      for (const item of s.regionalStructure) {
        const handler = regionMap[item.type];
        if (handler) handler(item.name);
      }
    }

    // Use ZIP from suggestion or try to extract from label
    if (s.zip) {
      set("zip", s.zip.replace(/\s/g, ""));
    } else {
      const zipMatch = s.label?.match(/\b(\d{3}\s?\d{2})\b/);
      if (zipMatch) {
        set("zip", zipMatch[1].replace(/\s/g, ""));
      }
    }

    set("latitude", s.position.lat);
    set("longitude", s.position.lon);
  }

  // Build payload
  // These text columns are NOT NULL DEFAULT '' in the DB — must send "" not null
  const NOT_NULL_TEXT_FIELDS = new Set([
    "title", "slug", "subtype", "rooms_label", "city", "district",
    "location_label", "summary", "image_src", "image_alt",
    "street", "zip", "region", "city_part",
  ]);

  function buildPayload(): Record<string, unknown> {
    const payload: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(form)) {
      if (value === "" && !NOT_NULL_TEXT_FIELDS.has(key)) {
        payload[key] = null;
        continue;
      }
      payload[key] = value;
    }

    return payload;
  }

  // Submit
  async function handleSubmit() {
    if (!form.title.trim()) {
      setError(t.admin.titleRequired);
      return;
    }
    if (!form.slug.trim()) {
      setError(t.admin.slugRequired);
      return;
    }
    if (!form.listing_type) {
      setError(t.admin.listingTypeRequired);
      return;
    }
    if (!form.category) {
      setError(t.admin.categoryRequired);
      return;
    }
    if (!form.price) {
      setError(t.admin.priceRequired);
      return;
    }
    if (!form.city.trim()) {
      setError(t.admin.cityRequired);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = buildPayload();

      const url = brokerMode ? "/api/broker/properties" : "/api/admin/properties";
      const method = mode === "create" ? "POST" : "PATCH";

      if (mode === "edit") {
        (payload as Record<string, unknown>).id = propertyId;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || t.admin.saveError);
      }

      setSuccess(true);
      setTimeout(() => {
        router.push(redirectTo || "/dashboard/sprava/nemovitosti");
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.admin.saveError);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="pf-loading">
        <div className="pf-spinner" />
        <p>{t.admin.loadingData}</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="pf-success">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <path d="M22 4L12 14.01l-3-3" />
        </svg>
        <h3>{mode === "create" ? t.admin.propertyCreated : t.admin.propertySaved}</h3>
        <p>{t.admin.redirecting}</p>
      </div>
    );
  }

  return (
    <div className="pf-layout">
      <div className="pf-main">
        {/* Header */}
        <div className="pf-header">
          <button
            className="admin-btn admin-btn--secondary"
            onClick={() => router.push("/dashboard/sprava/nemovitosti")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            {t.admin.back}
          </button>
          <h2>{mode === "create" ? t.admin.newProperty : t.admin.editProperty}</h2>
        </div>

        {/* Error */}
        {error && (
          <div className="pf-error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M15 9l-6 6M9 9l6 6" />
            </svg>
            {error}
            <button onClick={() => setError(null)} className="pf-error-close">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* ========== SECTION 1: Zakladni udaje a cena ========== */}
        <AccordionSection
          title={t.admin.basicInfoAndPrice}
          sectionKey="basic"
          openSections={openSections}
          toggle={toggleSection}
        >
          <div className="pf-section">
            <div className="admin-form-row">
              <SelectField
                label={t.admin.listingType}
                value={form.listing_type}
                onChange={(v) => set("listing_type", v)}
                options={ListingTypes}
                required
              />
              <SelectField
                label={t.admin.category}
                value={form.category}
                onChange={(v) => {
                  set("category", v);
                  set("subtype", "");
                }}
                options={PropertyCategories}
                required
              />
            </div>
            <div className="admin-form-row">
              <SelectField
                label={t.admin.subtype}
                value={form.subtype}
                onChange={(v) => {
                  set("subtype", v);
                  // Auto-fill rooms_label for apartments
                  if (form.category === "apartment" && v && /^\d\+/.test(v)) {
                    set("rooms_label", v);
                  }
                }}
                options={currentSubtypes}
              />
              <TextField
                label={t.admin.disposition}
                value={form.rooms_label}
                onChange={(v) => set("rooms_label", v)}
                placeholder={t.admin.dispositionPlaceholder}
              />
            </div>
            <TextField
              label={t.admin.listingTitle}
              value={form.title}
              onChange={(v) => set("title", v)}
              required
              placeholder={t.admin.listingTitlePlaceholder}
            />
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>
                  {t.admin.slugUrl}
                  <span className="pf-required">*</span>
                </label>
                <div className="pf-slug-row">
                  <input
                    type="text"
                    value={form.slug}
                    onChange={(e) => set("slug", e.target.value)}
                    placeholder="prodej-bytu-3kk-praha-5"
                  />
                  <button
                    type="button"
                    className="admin-btn admin-btn--secondary admin-btn--sm"
                    onClick={autoSlug}
                    title={t.admin.generateFromTitle}
                  >
                    Auto
                  </button>
                </div>
              </div>
            </div>

            <h4 className="pf-subtitle">{t.admin.price}</h4>
            <div className="admin-form-row">
              <NumberField
                label={t.admin.price}
                value={form.price}
                onChange={(v) => set("price", v ?? 0)}
                suffix={"K\u010d"}
                min={0}
              />
              <SelectField
                label={t.admin.priceCurrency}
                value={form.price_currency}
                onChange={(v) => set("price_currency", v)}
                options={PriceCurrencies}
              />
            </div>
            <div className="admin-form-row">
              <SelectField
                label={t.admin.priceUnit}
                value={form.price_unit}
                onChange={(v) => set("price_unit", v)}
                options={PriceUnits}
              />
              <CheckboxField
                label={t.admin.priceNegotiable}
                checked={form.price_negotiation}
                onChange={(v) => set("price_negotiation", v)}
              />
            </div>
            <TextField
              label={t.admin.priceNote}
              value={form.price_note}
              onChange={(v) => set("price_note", v)}
              placeholder={t.admin.priceNotePlaceholder}
            />
          </div>
        </AccordionSection>

        {/* ========== SECTION 2: Lokace ========== */}
        <AccordionSection
          title={t.admin.locationSection}
          sectionKey="location"
          openSections={openSections}
          toggle={toggleSection}
        >
          <div className="pf-section">
            <AddressAutocomplete
              onSelect={handleAddressSelect}
              isLand={form.category === "land"}
            />

            <div className="admin-form-row">
              <TextField
                label={t.admin.city}
                value={form.city}
                onChange={(v) => set("city", v)}
                required
                placeholder="Praha"
              />
              <TextField
                label={t.admin.district}
                value={form.district}
                onChange={(v) => set("district", v)}
                placeholder={"Praha-z\u00e1pad"}
              />
            </div>
            <div className="admin-form-row">
              <TextField
                label={t.admin.street}
                value={form.street}
                onChange={(v) => set("street", v)}
                placeholder="Vinohradsk\u00e1 123"
              />
              <TextField
                label={t.admin.cityPart}
                value={form.city_part}
                onChange={(v) => set("city_part", v)}
                placeholder="Vinohrady"
              />
            </div>
            <div className="admin-form-row">
              <TextField
                label={t.admin.zip}
                value={form.zip}
                onChange={(v) => set("zip", v)}
                placeholder="120 00"
              />
              <TextField
                label={t.admin.region}
                value={form.region}
                onChange={(v) => set("region", v)}
                placeholder={"Hlavn\u00ed m\u011bsto Praha"}
              />
            </div>
            <TextField
              label={t.admin.locationLabel}
              value={form.location_label}
              onChange={(v) => set("location_label", v)}
              placeholder={t.admin.locationLabelPlaceholder}
            />
            <div className="admin-form-row">
              <NumberField
                label={t.admin.latitude}
                value={form.latitude}
                onChange={(v) => set("latitude", v ?? 0)}
                step="0.000001"
                suffix="lat"
              />
              <NumberField
                label={t.admin.longitude}
                value={form.longitude}
                onChange={(v) => set("longitude", v ?? 0)}
                step="0.000001"
                suffix="lon"
              />
            </div>
          </div>
        </AccordionSection>

        {/* ========== SECTION 3: Popis a media ========== */}
        <AccordionSection
          title={t.admin.descriptionAndMedia}
          sectionKey="media"
          openSections={openSections}
          toggle={toggleSection}
        >
          <div className="pf-section">
            <TextareaField
              label={t.admin.summary}
              value={form.summary}
              onChange={(v) => set("summary", v)}
              placeholder={t.admin.summaryPlaceholder}
              rows={3}
            />
            <TextareaField
              label={t.admin.detailedDescription}
              value={form.description ?? ""}
              onChange={(v) => set("description", v)}
              placeholder={t.admin.detailedDescriptionPlaceholder}
              rows={10}
            />

            <h4 className="pf-subtitle">{t.admin.photos}</h4>
            <ImageDropZone
              images={form.images}
              onImagesChange={(v) => set("images", v)}
              imageSrc={form.image_src}
              onImageSrcChange={(v) => set("image_src", v)}
            />

            {form.image_src && (
              <div style={{ marginTop: 12 }}>
                <h4 className="pf-subtitle" style={{ marginTop: 0 }}>{t.admin.mainPhoto}</h4>
                <div className="pf-main-image-preview">
                  <img src={form.image_src} alt={form.image_alt || t.admin.mainPhoto} />
                </div>
                <TextField
                  label={t.admin.altText}
                  value={form.image_alt}
                  onChange={(v) => set("image_alt", v)}
                  placeholder={t.admin.altTextPlaceholder}
                />
              </div>
            )}

            <h4 className="pf-subtitle">{t.admin.virtualTours}</h4>
            <TextField
              label={t.admin.matterportUrl}
              value={form.matterport_url}
              onChange={(v) => set("matterport_url", v)}
              placeholder="https://my.matterport.com/show/?m=..."
            />
            <TextField
              label={t.admin.mapyPanoramaUrl}
              value={form.mapy_panorama_url}
              onChange={(v) => set("mapy_panorama_url", v)}
              placeholder="https://..."
            />
          </div>
        </AccordionSection>

        {/* ========== SECTION 4: Parametry ========== */}
        <AccordionSection
          title={t.admin.parameters}
          sectionKey="params"
          openSections={openSections}
          toggle={toggleSection}
        >
          <div className="pf-section">
            <h4 className="pf-subtitle" style={{ marginTop: 0, paddingTop: 0, borderTop: "none" }}>{t.admin.areas}</h4>
            <div className="admin-form-row">
              <NumberField label={t.admin.usableArea} value={form.area} onChange={(v) => set("area", v ?? 0)} suffix={"m\u00b2"} min={0} />
              <NumberField label={t.admin.landArea} value={form.land_area} onChange={(v) => set("land_area", v)} suffix={"m\u00b2"} min={0} />
            </div>
            <div className="admin-form-row">
              <NumberField label={t.admin.builtUpArea} value={form.built_up_area} onChange={(v) => set("built_up_area", v)} suffix={"m\u00b2"} />
              <NumberField label={t.admin.totalArea} value={form.floor_area} onChange={(v) => set("floor_area", v)} suffix={"m\u00b2"} />
            </div>
            <div className="admin-form-row">
              <NumberField label={t.admin.balconyArea} value={form.balcony_area} onChange={(v) => set("balcony_area", v)} suffix={"m\u00b2"} />
              <NumberField label={t.admin.loggiaArea} value={form.loggia_area} onChange={(v) => set("loggia_area", v)} suffix={"m\u00b2"} />
            </div>
            <div className="admin-form-row">
              <NumberField label={t.admin.terraceArea} value={form.terrace_area} onChange={(v) => set("terrace_area", v)} suffix={"m\u00b2"} />
              <NumberField label={t.admin.gardenArea} value={form.garden_area} onChange={(v) => set("garden_area", v)} suffix={"m\u00b2"} />
            </div>
            <div className="admin-form-row">
              <NumberField label={t.admin.cellarArea} value={form.cellar_area} onChange={(v) => set("cellar_area", v)} suffix={"m\u00b2"} />
              <NumberField label={t.admin.basinArea} value={form.basin_area} onChange={(v) => set("basin_area", v)} suffix={"m\u00b2"} />
            </div>
            <div className="admin-form-row">
              <NumberField label={t.admin.officesArea} value={form.offices_area} onChange={(v) => set("offices_area", v)} suffix={"m\u00b2"} />
              <NumberField label={t.admin.productionArea} value={form.production_area} onChange={(v) => set("production_area", v)} suffix={"m\u00b2"} />
            </div>
            <div className="admin-form-row">
              <NumberField label={t.admin.shopArea} value={form.shop_area} onChange={(v) => set("shop_area", v)} suffix={"m\u00b2"} />
              <NumberField label={t.admin.storageArea} value={form.store_area} onChange={(v) => set("store_area", v)} suffix={"m\u00b2"} />
            </div>
            <div className="admin-form-row">
              <NumberField label={t.admin.workshopArea} value={form.workshop_area} onChange={(v) => set("workshop_area", v)} suffix={"m\u00b2"} />
              <NumberField label={t.admin.nonResidentialTotal} value={form.nolive_total_area} onChange={(v) => set("nolive_total_area", v)} suffix={"m\u00b2"} />
            </div>

            <h4 className="pf-subtitle">{t.admin.conditionAndParams}</h4>
            <div className="admin-form-row">
              <SelectField label={t.admin.objectCondition} value={form.condition} onChange={(v) => set("condition", v)} options={PropertyConditions} />
              <SelectField label={t.admin.ownership} value={form.ownership} onChange={(v) => set("ownership", v)} options={OwnershipTypes} />
            </div>
            <div className="admin-form-row">
              <SelectField label={t.admin.furnishing} value={form.furnishing} onChange={(v) => set("furnishing", v)} options={FurnishingTypes} />
              <SelectField label={t.admin.energyLabel} value={form.energy_rating} onChange={(v) => set("energy_rating", v)} options={EnergyRatings} />
            </div>
            <div className="admin-form-row">
              <SelectField label={t.admin.buildingMaterial} value={form.building_material} onChange={(v) => set("building_material", v)} options={BuildingMaterials} />
              <TextField label={t.admin.flooring} value={form.flooring} onChange={(v) => set("flooring", v)} placeholder={t.admin.flooringPlaceholder} />
            </div>

            <h4 className="pf-subtitle">{t.admin.houseApartmentSpecific}</h4>
            <div className="admin-form-row">
              <SelectField label={t.admin.houseType} value={form.object_type} onChange={(v) => set("object_type", v)} options={ObjectTypes} />
              <SelectField label={t.admin.housePosition} value={form.object_kind} onChange={(v) => set("object_kind", v)} options={ObjectKinds} />
            </div>
            <div className="admin-form-row">
              <SelectField label={t.admin.objectPlacement} value={form.object_location} onChange={(v) => set("object_location", v)} options={ObjectLocations} />
              <SelectField label={t.admin.apartmentType} value={form.flat_class} onChange={(v) => set("flat_class", v)} options={FlatClasses} />
            </div>

            <h4 className="pf-subtitle">{t.admin.floors}</h4>
            <div className="admin-form-row">
              <NumberField label={t.admin.floor} value={form.floor} onChange={(v) => set("floor", v)} placeholder={"nap\u0159. 3"} />
              <NumberField label={t.admin.totalFloors} value={form.total_floors} onChange={(v) => set("total_floors", v)} placeholder={"nap\u0159. 8"} />
            </div>
            <div className="admin-form-row">
              <NumberField label={t.admin.undergroundFloors} value={form.underground_floors} onChange={(v) => set("underground_floors", v)} />
              <NumberField label={t.admin.ceilingHeight} value={form.ceiling_height} onChange={(v) => set("ceiling_height", v)} suffix="m" step="0.01" />
            </div>

            <h4 className="pf-subtitle">{t.admin.parkingSection}</h4>
            <div className="admin-form-row">
              <SelectField label={t.admin.parkingType} value={form.parking} onChange={(v) => set("parking", v)} options={ParkingTypes} />
              <NumberField label={t.admin.parkingSpaces} value={form.parking_spaces} onChange={(v) => set("parking_spaces", v)} min={0} />
            </div>
            <NumberField label={t.admin.garageCount} value={form.garage_count} onChange={(v) => set("garage_count", v)} min={0} />

            <h4 className="pf-subtitle">{t.admin.equipmentAndFeatures}</h4>
            <div className="pf-checkbox-grid">
              <CheckboxField label={t.admin.balconyLabel} checked={form.balcony} onChange={(v) => set("balcony", v)} />
              <CheckboxField label={t.admin.terraceLabel} checked={form.terrace} onChange={(v) => set("terrace", v)} />
              <CheckboxField label={t.admin.gardenLabel} checked={form.garden} onChange={(v) => set("garden", v)} />
              <CheckboxField label={t.admin.elevatorLabel} checked={form.elevator} onChange={(v) => set("elevator", v)} />
              <CheckboxField label={t.admin.cellarLabel} checked={form.cellar} onChange={(v) => set("cellar", v)} />
              <CheckboxField label={t.admin.garageLabel} checked={form.garage} onChange={(v) => set("garage", v)} />
              <CheckboxField label={t.admin.poolLabel} checked={form.pool} onChange={(v) => set("pool", v)} />
              <CheckboxField label={t.admin.loggiaLabel} checked={form.loggia} onChange={(v) => set("loggia", v)} />
              <CheckboxField label={t.admin.lowEnergyLabel} checked={form.low_energy} onChange={(v) => set("low_energy", v)} />
              <CheckboxField label={t.admin.ftvPanelsLabel} checked={form.ftv_panels} onChange={(v) => set("ftv_panels", v)} />
              <CheckboxField label={t.admin.solarPanelsLabel} checked={form.solar_panels} onChange={(v) => set("solar_panels", v)} />
              <CheckboxField label={t.admin.mortgagePossible} checked={form.mortgage} onChange={(v) => set("mortgage", v)} />
            </div>
            <div className="admin-form-row" style={{ marginTop: 16 }}>
              <SelectField label={t.admin.barrierFreeAccess} value={form.easy_access} onChange={(v) => set("easy_access", v)} options={EasyAccessTypes} />
            </div>

            <h4 className="pf-subtitle">{t.admin.age}</h4>
            <div className="admin-form-row">
              <NumberField label={t.admin.yearBuilt} value={form.year_built} onChange={(v) => set("year_built", v)} placeholder="1985" />
              <NumberField label={t.admin.lastRenovation} value={form.last_renovation} onChange={(v) => set("last_renovation", v)} placeholder="2020" />
            </div>
            <NumberField label={t.admin.acceptanceYear} value={form.acceptance_year} onChange={(v) => set("acceptance_year", v)} placeholder="1986" />
          </div>
        </AccordionSection>

        {/* ========== SECTION 5: Rozsirene udaje ========== */}
        <AccordionSection
          title={t.admin.extendedInfo}
          sectionKey="extended"
          openSections={openSections}
          toggle={toggleSection}
        >
          <div className="pf-section">
            <h4 className="pf-subtitle" style={{ marginTop: 0, paddingTop: 0, borderTop: "none" }}>{t.admin.heating}</h4>
            <MultiSelectField label={t.admin.heatingType} value={form.heating} onChange={(v) => set("heating", v)} options={HeatingTypes} />
            <MultiSelectField label={t.admin.heatingElement} value={form.heating_element} onChange={(v) => set("heating_element", v)} options={HeatingElements} />
            <MultiSelectField label={t.admin.heatingSource} value={form.heating_source} onChange={(v) => set("heating_source", v)} options={HeatingSources} />
            <MultiSelectField label={t.admin.hotWaterSource} value={form.water_heat_source} onChange={(v) => set("water_heat_source", v)} options={WaterHeatSources} />

            <h4 className="pf-subtitle">{t.admin.infrastructure}</h4>
            <MultiSelectField label={t.admin.electricity} value={form.electricity} onChange={(v) => set("electricity", v)} options={ElectricityTypes} />
            <MultiSelectField label={t.admin.gas} value={form.gas} onChange={(v) => set("gas", v)} options={GasTypes} />
            <MultiSelectField label={t.admin.water} value={form.water} onChange={(v) => set("water", v)} options={WaterTypes} />
            <MultiSelectField label={t.admin.sewage} value={form.gully} onChange={(v) => set("gully", v)} options={GullyTypes} />
            <MultiSelectField label={t.admin.roads} value={form.road_type} onChange={(v) => set("road_type", v)} options={RoadTypes} />
            <MultiSelectField label={t.admin.telecom} value={form.telecommunication} onChange={(v) => set("telecommunication", v)} options={TelecommunicationTypes} />
            <MultiSelectField label={t.admin.transport} value={form.transport} onChange={(v) => set("transport", v)} options={TransportTypes} />
            <MultiSelectField label={t.admin.internet} value={form.internet_connection_type} onChange={(v) => set("internet_connection_type", v)} options={InternetConnectionTypes} />

            <div className="admin-form-row">
              <TextField label={t.admin.internetProvider} value={form.internet_connection_provider} onChange={(v) => set("internet_connection_provider", v)} placeholder={t.admin.internetProviderPlaceholder} />
              <NumberField label={t.admin.internetSpeed} value={form.internet_connection_speed} onChange={(v) => set("internet_connection_speed", v)} suffix="Mbps" />
            </div>

            <div className="admin-form-row">
              <SelectField label={t.admin.developmentType} value={form.surroundings_type} onChange={(v) => set("surroundings_type", v)} options={SurroundingsTypes} />
              <SelectField label={t.admin.protection} value={form.protection} onChange={(v) => set("protection", v)} options={ProtectionTypes} />
            </div>
            <div className="admin-form-row">
              <SelectField label={t.admin.circuitBreaker} value={form.circuit_breaker} onChange={(v) => set("circuit_breaker", v)} options={CircuitBreakers} />
              <SelectField label={t.admin.phase} value={form.phase_distribution} onChange={(v) => set("phase_distribution", v)} options={PhaseDistributions} />
            </div>
            <MultiSelectField label={t.admin.wellType} value={form.well_type} onChange={(v) => set("well_type", v)} options={WellTypes} />

            <h4 className="pf-subtitle">{t.admin.financialInfo}</h4>
            <div className="admin-form-row">
              <NumberField label={t.admin.annuity} value={form.annuity} onChange={(v) => set("annuity", v)} suffix={"K\u010d"} />
              <TextField label={t.admin.livingCosts} value={form.cost_of_living} onChange={(v) => set("cost_of_living", v)} placeholder={t.admin.livingCostsPlaceholder} />
            </div>
            <div className="admin-form-row">
              <NumberField label={t.admin.commissionLabel} value={form.commission} onChange={(v) => set("commission", v)} suffix={"K\u010d"} />
              <NumberField label={t.admin.mortgagePercent} value={form.mortgage_percent} onChange={(v) => set("mortgage_percent", v)} suffix="%" />
            </div>
            <div className="admin-form-row">
              <NumberField label={t.admin.savingsPercent} value={form.spor_percent} onChange={(v) => set("spor_percent", v)} suffix="%" />
              <NumberField label={t.admin.refundableDeposit} value={form.refundable_deposit} onChange={(v) => set("refundable_deposit", v)} suffix={"K\u010d"} />
            </div>

            <h4 className="pf-subtitle">{t.admin.rentalAuctionShares}</h4>
            <div className="pf-conditional">
              <h4 className="pf-subtitle">{t.admin.rental}</h4>
              <p className="pf-hint">{t.admin.rentalHint}</p>
              <div className="admin-form-row">
                <SelectField label={t.admin.leaseType} value={form.lease_type} onChange={(v) => set("lease_type", v)} options={LeaseTypes} />
                <CheckboxField label={t.admin.tenantNoCommission} checked={form.tenant_not_pay_commission} onChange={(v) => set("tenant_not_pay_commission", v)} />
              </div>
              <TextField label={t.admin.moveInDate} value={form.ready_date} onChange={(v) => set("ready_date", v)} type="date" />
            </div>

            <div className="pf-conditional">
              <h4 className="pf-subtitle">{t.admin.auction}</h4>
              <p className="pf-hint">{t.admin.auctionHint}</p>
              <div className="admin-form-row">
                <SelectField label={t.admin.auctionType} value={form.auction_kind} onChange={(v) => set("auction_kind", v)} options={AuctionKinds} />
                <TextField label={t.admin.auctionDate} value={form.auction_date} onChange={(v) => set("auction_date", v)} type="date" />
              </div>
              <TextField label={t.admin.auctionPlace} value={form.auction_place} onChange={(v) => set("auction_place", v)} placeholder={t.admin.auctionPlacePlaceholder} />
              <div className="admin-form-row">
                <NumberField label={t.admin.auctionDeposit} value={form.price_auction_principal} onChange={(v) => set("price_auction_principal", v)} suffix={"K\u010d"} />
                <NumberField label={t.admin.expertReportPrice} value={form.price_expert_report} onChange={(v) => set("price_expert_report", v)} suffix={"K\u010d"} />
              </div>
              <NumberField label={t.admin.minimumBid} value={form.price_minimum_bid} onChange={(v) => set("price_minimum_bid", v)} suffix={"K\u010d"} />
            </div>

            <div className="pf-conditional">
              <h4 className="pf-subtitle">{t.admin.shares}</h4>
              <p className="pf-hint">{t.admin.sharesHint}</p>
              <div className="admin-form-row">
                <NumberField label={t.admin.shareNumerator} value={form.share_numerator} onChange={(v) => set("share_numerator", v)} placeholder={t.admin.shareNumeratorPlaceholder} />
                <NumberField label={t.admin.shareDenominator} value={form.share_denominator} onChange={(v) => set("share_denominator", v)} placeholder={t.admin.shareDenominatorPlaceholder} />
              </div>
            </div>

            <h4 className="pf-subtitle">{t.admin.datesAndStatus}</h4>
            <div className="admin-form-row">
              <TextField label={t.admin.constructionStart} value={form.beginning_date} onChange={(v) => set("beginning_date", v)} type="date" />
              <TextField label={t.admin.constructionEnd} value={form.finish_date} onChange={(v) => set("finish_date", v)} type="date" />
            </div>
            <div className="admin-form-row">
              <TextField label={t.admin.saleDate} value={form.sale_date} onChange={(v) => set("sale_date", v)} type="date" />
              <TextField label={t.admin.firstTour} value={form.first_tour_date} onChange={(v) => set("first_tour_date", v)} type="date" />
            </div>
            <div className="admin-form-row">
              <SelectField label={t.admin.status} value={form.extra_info} onChange={(v) => set("extra_info", v)} options={ExtraInfoStatuses} />
              <SelectField label={t.admin.personalTransfer} value={form.personal_transfer} onChange={(v) => set("personal_transfer", v)} options={PersonalTransferTypes} />
            </div>
            <div className="admin-form-row">
              <CheckboxField label={t.admin.exclusiveAtRk} checked={form.exclusively_at_rk} onChange={(v) => set("exclusively_at_rk", v)} />
              <NumberField label={t.admin.ownerCount} value={form.num_owners} onChange={(v) => set("num_owners", v)} />
            </div>
            <NumberField label={t.admin.apartmentNumber} value={form.apartment_number} onChange={(v) => set("apartment_number", v)} />

            <h4 className="pf-subtitle">{t.admin.keywords}</h4>
            <TagsField
              label={t.admin.keywords}
              value={form.keywords}
              onChange={(v) => set("keywords", v)}
              placeholder={t.admin.keywordsPlaceholder}
            />

            <h4 className="pf-subtitle">{t.admin.brokerAndPublication}</h4>
            {!brokerMode ? (
              /* Admin mode: full broker list */
              <div className="admin-form-group">
                <label>{t.admin.assignedBroker}</label>
                <select value={form.broker_id} onChange={(e) => set("broker_id", e.target.value)}>
                  <option value="">{t.admin.assignedBrokerNone}</option>
                  {brokers.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            ) : agencyBrokers && agencyBrokers.length > 1 ? (
              /* Broker mode with agency team: show team brokers */
              <div className="admin-form-group">
                <label>{t.admin.assignToBroker}</label>
                <select value={form.broker_id} onChange={(e) => set("broker_id", e.target.value)}>
                  {agencyBrokers.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            ) : null /* Solo broker: broker_id auto-assigned, no selector */}
            <div className="admin-form-group">
              <label>{t.admin.project}</label>
              <select value={form.project_id} onChange={(e) => set("project_id", e.target.value)}>
                <option value="">{t.admin.projectNone}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="pf-checkbox-grid" style={{ marginTop: 16 }}>
              <CheckboxField label={t.admin.activeOnWeb} checked={form.active} onChange={(v) => set("active", v)} />
              <CheckboxField label={t.admin.featuredPremium} checked={form.featured} onChange={(v) => set("featured", v)} />
            </div>
          </div>
        </AccordionSection>

        {/* Submit bar */}
        <div className="pf-submit-bar">
          <button
            className="admin-btn admin-btn--primary"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? (
              <span className="pf-spinner-sm" />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
            )}
            {mode === "create" ? t.admin.createProperty : t.admin.saveChanges}
          </button>
        </div>
      </div>

      {/* Live preview */}
      <LivePreview form={form} />
    </div>
  );
}
