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
        .catch(() => setError("Nepoda\u0159ilo se na\u010d\u00edst nemovitost"))
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
      setError("N\u00e1zev je povinn\u00fd");
      return;
    }
    if (!form.slug.trim()) {
      setError("Slug je povinn\u00fd");
      return;
    }
    if (!form.listing_type) {
      setError("Typ nab\u00eddky je povinn\u00fd");
      return;
    }
    if (!form.category) {
      setError("Kategorie je povinn\u00e1");
      return;
    }
    if (!form.price) {
      setError("Cena je povinn\u00e1");
      return;
    }
    if (!form.city.trim()) {
      setError("M\u011bsto je povinn\u00e9");
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
        throw new Error(data?.error || "Chyba p\u0159i ukl\u00e1d\u00e1n\u00ed");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push(redirectTo || "/dashboard/sprava/nemovitosti");
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba p\u0159i ukl\u00e1d\u00e1n\u00ed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="pf-loading">
        <div className="pf-spinner" />
        <p>{"Na\u010d\u00edt\u00e1m data..."}</p>
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
        <h3>{mode === "create" ? "Nemovitost vytvo\u0159ena" : "Nemovitost ulo\u017eena"}</h3>
        <p>{"P\u0159esm\u011brov\u00e1v\u00e1m..."}</p>
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
            {"Zp\u011bt"}
          </button>
          <h2>{mode === "create" ? "Nov\u00e1 nemovitost" : "Upravit nemovitost"}</h2>
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
          title={"Z\u00e1kladn\u00ed \u00fadaje a cena"}
          sectionKey="basic"
          openSections={openSections}
          toggle={toggleSection}
        >
          <div className="pf-section">
            <div className="admin-form-row">
              <SelectField
                label={"Typ nab\u00eddky"}
                value={form.listing_type}
                onChange={(v) => set("listing_type", v)}
                options={ListingTypes}
                required
              />
              <SelectField
                label="Kategorie"
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
                label="Podtyp"
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
                label="Dispozice"
                value={form.rooms_label}
                onChange={(v) => set("rooms_label", v)}
                placeholder={"nap\u0159. 3+kk"}
              />
            </div>
            <TextField
              label={"N\u00e1zev inzer\u00e1tu"}
              value={form.title}
              onChange={(v) => set("title", v)}
              required
              placeholder="Prodej bytu 3+kk, Praha 5"
            />
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>
                  Slug (URL)
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
                    title={"Vygenerovat z n\u00e1zvu"}
                  >
                    Auto
                  </button>
                </div>
              </div>
            </div>

            <h4 className="pf-subtitle">Cena</h4>
            <div className="admin-form-row">
              <NumberField
                label="Cena"
                value={form.price}
                onChange={(v) => set("price", v ?? 0)}
                suffix={"K\u010d"}
                min={0}
              />
              <SelectField
                label={"M\u011bna"}
                value={form.price_currency}
                onChange={(v) => set("price_currency", v)}
                options={PriceCurrencies}
              />
            </div>
            <div className="admin-form-row">
              <SelectField
                label="Jednotka ceny"
                value={form.price_unit}
                onChange={(v) => set("price_unit", v)}
                options={PriceUnits}
              />
              <CheckboxField
                label={"Cena k jedn\u00e1n\u00ed"}
                checked={form.price_negotiation}
                onChange={(v) => set("price_negotiation", v)}
              />
            </div>
            <TextField
              label={"Pozn\u00e1mka k cen\u011b"}
              value={form.price_note}
              onChange={(v) => set("price_note", v)}
              placeholder={"nap\u0159. Cena v\u010detn\u011b provize"}
            />
          </div>
        </AccordionSection>

        {/* ========== SECTION 2: Lokace ========== */}
        <AccordionSection
          title="Lokace"
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
                label={"M\u011bsto"}
                value={form.city}
                onChange={(v) => set("city", v)}
                required
                placeholder="Praha"
              />
              <TextField
                label="Okres"
                value={form.district}
                onChange={(v) => set("district", v)}
                placeholder={"Praha-z\u00e1pad"}
              />
            </div>
            <div className="admin-form-row">
              <TextField
                label="Ulice"
                value={form.street}
                onChange={(v) => set("street", v)}
                placeholder="Vinohradsk\u00e1 123"
              />
              <TextField
                label={"M\u011bstsk\u00e1 \u010d\u00e1st"}
                value={form.city_part}
                onChange={(v) => set("city_part", v)}
                placeholder="Vinohrady"
              />
            </div>
            <div className="admin-form-row">
              <TextField
                label={"PS\u010c"}
                value={form.zip}
                onChange={(v) => set("zip", v)}
                placeholder="120 00"
              />
              <TextField
                label="Kraj"
                value={form.region}
                onChange={(v) => set("region", v)}
                placeholder={"Hlavn\u00ed m\u011bsto Praha"}
              />
            </div>
            <TextField
              label={"Popis lokace (automaticky)"}
              value={form.location_label}
              onChange={(v) => set("location_label", v)}
              placeholder={"Automaticky z ulice, \u010d\u00e1sti, m\u011bsta"}
            />
            <div className="admin-form-row">
              <NumberField
                label={"Zem\u011bpisn\u00e1 \u0161\u00ed\u0159ka"}
                value={form.latitude}
                onChange={(v) => set("latitude", v ?? 0)}
                step="0.000001"
                suffix="lat"
              />
              <NumberField
                label={"Zem\u011bpisn\u00e1 d\u00e9lka"}
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
          title={"Popis a m\u00e9dia"}
          sectionKey="media"
          openSections={openSections}
          toggle={toggleSection}
        >
          <div className="pf-section">
            <TextareaField
              label={"Stru\u010dn\u00fd popis (summary)"}
              value={form.summary}
              onChange={(v) => set("summary", v)}
              placeholder={"Kr\u00e1tk\u00fd popisek pro karti\u010dku a n\u00e1hled..."}
              rows={3}
            />
            <TextareaField
              label={"Podrobn\u00fd popis"}
              value={form.description ?? ""}
              onChange={(v) => set("description", v)}
              placeholder={"Podrobn\u00fd popis nemovitosti v\u010detn\u011b v\u0161ech d\u016fle\u017eit\u00fdch informac\u00ed..."}
              rows={10}
            />

            <h4 className="pf-subtitle">{"Fotky"}</h4>
            <ImageDropZone
              images={form.images}
              onImagesChange={(v) => set("images", v)}
              imageSrc={form.image_src}
              onImageSrcChange={(v) => set("image_src", v)}
            />

            {form.image_src && (
              <div style={{ marginTop: 12 }}>
                <h4 className="pf-subtitle" style={{ marginTop: 0 }}>{"Hlavn\u00ed fotka"}</h4>
                <div className="pf-main-image-preview">
                  <img src={form.image_src} alt={form.image_alt || "N\u00e1hled"} />
                </div>
                <TextField
                  label="Alt text"
                  value={form.image_alt}
                  onChange={(v) => set("image_alt", v)}
                  placeholder="Popis fotky"
                />
              </div>
            )}

            <h4 className="pf-subtitle">{"Virtu\u00e1ln\u00ed prohl\u00eddky"}</h4>
            <TextField
              label={"Matterport URL (3D prohl\u00eddka)"}
              value={form.matterport_url}
              onChange={(v) => set("matterport_url", v)}
              placeholder="https://my.matterport.com/show/?m=..."
            />
            <TextField
              label="Mapy.cz panorama URL"
              value={form.mapy_panorama_url}
              onChange={(v) => set("mapy_panorama_url", v)}
              placeholder="https://..."
            />
          </div>
        </AccordionSection>

        {/* ========== SECTION 4: Parametry ========== */}
        <AccordionSection
          title="Parametry"
          sectionKey="params"
          openSections={openSections}
          toggle={toggleSection}
        >
          <div className="pf-section">
            <h4 className="pf-subtitle" style={{ marginTop: 0, paddingTop: 0, borderTop: "none" }}>Plochy</h4>
            <div className="admin-form-row">
              <NumberField label={"U\u017eitn\u00e1 plocha"} value={form.area} onChange={(v) => set("area", v ?? 0)} suffix={"m\u00b2"} min={0} />
              <NumberField label="Plocha pozemku" value={form.land_area} onChange={(v) => set("land_area", v)} suffix={"m\u00b2"} min={0} />
            </div>
            <div className="admin-form-row">
              <NumberField label={"Zastav\u011bn\u00e1 plocha"} value={form.built_up_area} onChange={(v) => set("built_up_area", v)} suffix={"m\u00b2"} />
              <NumberField label={"Celkov\u00e1 plocha"} value={form.floor_area} onChange={(v) => set("floor_area", v)} suffix={"m\u00b2"} />
            </div>
            <div className="admin-form-row">
              <NumberField label="Balkon" value={form.balcony_area} onChange={(v) => set("balcony_area", v)} suffix={"m\u00b2"} />
              <NumberField label={"Lod\u017eie"} value={form.loggia_area} onChange={(v) => set("loggia_area", v)} suffix={"m\u00b2"} />
            </div>
            <div className="admin-form-row">
              <NumberField label="Terasa" value={form.terrace_area} onChange={(v) => set("terrace_area", v)} suffix={"m\u00b2"} />
              <NumberField label="Zahrada" value={form.garden_area} onChange={(v) => set("garden_area", v)} suffix={"m\u00b2"} />
            </div>
            <div className="admin-form-row">
              <NumberField label="Sklep" value={form.cellar_area} onChange={(v) => set("cellar_area", v)} suffix={"m\u00b2"} />
              <NumberField label={"Baz\u00e9n"} value={form.basin_area} onChange={(v) => set("basin_area", v)} suffix={"m\u00b2"} />
            </div>
            <div className="admin-form-row">
              <NumberField label={"Kancel\u00e1\u0159e"} value={form.offices_area} onChange={(v) => set("offices_area", v)} suffix={"m\u00b2"} />
              <NumberField label={"V\u00fdroba"} value={form.production_area} onChange={(v) => set("production_area", v)} suffix={"m\u00b2"} />
            </div>
            <div className="admin-form-row">
              <NumberField label="Obchod" value={form.shop_area} onChange={(v) => set("shop_area", v)} suffix={"m\u00b2"} />
              <NumberField label="Sklad" value={form.store_area} onChange={(v) => set("store_area", v)} suffix={"m\u00b2"} />
            </div>
            <div className="admin-form-row">
              <NumberField label={"D\u00edlna"} value={form.workshop_area} onChange={(v) => set("workshop_area", v)} suffix={"m\u00b2"} />
              <NumberField label={"Nebytov\u00e9 prostory celkem"} value={form.nolive_total_area} onChange={(v) => set("nolive_total_area", v)} suffix={"m\u00b2"} />
            </div>

            <h4 className="pf-subtitle">Stav a parametry</h4>
            <div className="admin-form-row">
              <SelectField label="Stav objektu" value={form.condition} onChange={(v) => set("condition", v)} options={PropertyConditions} />
              <SelectField label={"Vlastnictv\u00ed"} value={form.ownership} onChange={(v) => set("ownership", v)} options={OwnershipTypes} />
            </div>
            <div className="admin-form-row">
              <SelectField label={"Vybaven\u00ed"} value={form.furnishing} onChange={(v) => set("furnishing", v)} options={FurnishingTypes} />
              <SelectField label={"Energetick\u00fd \u0161t\u00edtek"} value={form.energy_rating} onChange={(v) => set("energy_rating", v)} options={EnergyRatings} />
            </div>
            <div className="admin-form-row">
              <SelectField label={"Materi\u00e1l stavby"} value={form.building_material} onChange={(v) => set("building_material", v)} options={BuildingMaterials} />
              <TextField label="Podlaha" value={form.flooring} onChange={(v) => set("flooring", v)} placeholder={"nap\u0159. dla\u017eba, lamin\u00e1t"} />
            </div>

            <h4 className="pf-subtitle">{"D\u016fm / Byt specifick\u00e9"}</h4>
            <div className="admin-form-row">
              <SelectField label={"Typ domu"} value={form.object_type} onChange={(v) => set("object_type", v)} options={ObjectTypes} />
              <SelectField label={"Poloha domu"} value={form.object_kind} onChange={(v) => set("object_kind", v)} options={ObjectKinds} />
            </div>
            <div className="admin-form-row">
              <SelectField label={"Um\u00edst\u011bn\u00ed objektu"} value={form.object_location} onChange={(v) => set("object_location", v)} options={ObjectLocations} />
              <SelectField label={"Typ bytu"} value={form.flat_class} onChange={(v) => set("flat_class", v)} options={FlatClasses} />
            </div>

            <h4 className="pf-subtitle">{"Podla\u017e\u00ed"}</h4>
            <div className="admin-form-row">
              <NumberField label={"Podla\u017e\u00ed"} value={form.floor} onChange={(v) => set("floor", v)} placeholder={"nap\u0159. 3"} />
              <NumberField label={"Po\u010det podla\u017e\u00ed celkem"} value={form.total_floors} onChange={(v) => set("total_floors", v)} placeholder={"nap\u0159. 8"} />
            </div>
            <div className="admin-form-row">
              <NumberField label={"Podzemn\u00ed podla\u017e\u00ed"} value={form.underground_floors} onChange={(v) => set("underground_floors", v)} />
              <NumberField label={"Sv\u011btl\u00e1 v\u00fd\u0161ka stropu"} value={form.ceiling_height} onChange={(v) => set("ceiling_height", v)} suffix="m" step="0.01" />
            </div>

            <h4 className="pf-subtitle">{"Parkov\u00e1n\u00ed"}</h4>
            <div className="admin-form-row">
              <SelectField label={"Typ parkov\u00e1n\u00ed"} value={form.parking} onChange={(v) => set("parking", v)} options={ParkingTypes} />
              <NumberField label={"Po\u010det parkovac\u00edch m\u00edst"} value={form.parking_spaces} onChange={(v) => set("parking_spaces", v)} min={0} />
            </div>
            <NumberField label={"Po\u010det gar\u00e1\u017e\u00ed"} value={form.garage_count} onChange={(v) => set("garage_count", v)} min={0} />

            <h4 className="pf-subtitle">{"Vybaven\u00ed a vlastnosti"}</h4>
            <div className="pf-checkbox-grid">
              <CheckboxField label="Balkon" checked={form.balcony} onChange={(v) => set("balcony", v)} />
              <CheckboxField label="Terasa" checked={form.terrace} onChange={(v) => set("terrace", v)} />
              <CheckboxField label="Zahrada" checked={form.garden} onChange={(v) => set("garden", v)} />
              <CheckboxField label={"V\u00fdtah"} checked={form.elevator} onChange={(v) => set("elevator", v)} />
              <CheckboxField label="Sklep" checked={form.cellar} onChange={(v) => set("cellar", v)} />
              <CheckboxField label={"Gar\u00e1\u017e"} checked={form.garage} onChange={(v) => set("garage", v)} />
              <CheckboxField label={"Baz\u00e9n"} checked={form.pool} onChange={(v) => set("pool", v)} />
              <CheckboxField label={"Lod\u017eie"} checked={form.loggia} onChange={(v) => set("loggia", v)} />
              <CheckboxField label={"N\u00edzkoenergetick\u00fd"} checked={form.low_energy} onChange={(v) => set("low_energy", v)} />
              <CheckboxField label="FTV panely" checked={form.ftv_panels} onChange={(v) => set("ftv_panels", v)} />
              <CheckboxField label={"Sol\u00e1rn\u00ed panely"} checked={form.solar_panels} onChange={(v) => set("solar_panels", v)} />
              <CheckboxField label={"Hypot\u00e9ka mo\u017en\u00e1"} checked={form.mortgage} onChange={(v) => set("mortgage", v)} />
            </div>
            <div className="admin-form-row" style={{ marginTop: 16 }}>
              <SelectField label={"Bezbar\u00e9rov\u00fd p\u0159\u00edstup"} value={form.easy_access} onChange={(v) => set("easy_access", v)} options={EasyAccessTypes} />
            </div>

            <h4 className="pf-subtitle">{"St\u00e1\u0159\u00ed"}</h4>
            <div className="admin-form-row">
              <NumberField label={"Rok v\u00fdstavby"} value={form.year_built} onChange={(v) => set("year_built", v)} placeholder="1985" />
              <NumberField label={"Posledn\u00ed rekonstrukce"} value={form.last_renovation} onChange={(v) => set("last_renovation", v)} placeholder="2020" />
            </div>
            <NumberField label="Rok kolaudace" value={form.acceptance_year} onChange={(v) => set("acceptance_year", v)} placeholder="1986" />
          </div>
        </AccordionSection>

        {/* ========== SECTION 5: Rozsirene udaje ========== */}
        <AccordionSection
          title={"Roz\u0161\u00ed\u0159en\u00e9 \u00fadaje"}
          sectionKey="extended"
          openSections={openSections}
          toggle={toggleSection}
        >
          <div className="pf-section">
            <h4 className="pf-subtitle" style={{ marginTop: 0, paddingTop: 0, borderTop: "none" }}>{"Top\u011bn\u00ed"}</h4>
            <MultiSelectField label={"Typ topen\u00ed"} value={form.heating} onChange={(v) => set("heating", v)} options={HeatingTypes} />
            <MultiSelectField label={"Topn\u00e9 t\u011bleso"} value={form.heating_element} onChange={(v) => set("heating_element", v)} options={HeatingElements} />
            <MultiSelectField label={"Zdroj top\u011bn\u00ed"} value={form.heating_source} onChange={(v) => set("heating_source", v)} options={HeatingSources} />
            <MultiSelectField label={"Zdroj tepl\u00e9 vody"} value={form.water_heat_source} onChange={(v) => set("water_heat_source", v)} options={WaterHeatSources} />

            <h4 className="pf-subtitle">Infrastruktura</h4>
            <MultiSelectField label={"Elekt\u0159ina"} value={form.electricity} onChange={(v) => set("electricity", v)} options={ElectricityTypes} />
            <MultiSelectField label="Plyn" value={form.gas} onChange={(v) => set("gas", v)} options={GasTypes} />
            <MultiSelectField label="Voda" value={form.water} onChange={(v) => set("water", v)} options={WaterTypes} />
            <MultiSelectField label="Odpad" value={form.gully} onChange={(v) => set("gully", v)} options={GullyTypes} />
            <MultiSelectField label="Komunikace" value={form.road_type} onChange={(v) => set("road_type", v)} options={RoadTypes} />
            <MultiSelectField label="Telekomunikace" value={form.telecommunication} onChange={(v) => set("telecommunication", v)} options={TelecommunicationTypes} />
            <MultiSelectField label="Doprava" value={form.transport} onChange={(v) => set("transport", v)} options={TransportTypes} />
            <MultiSelectField label="Internet" value={form.internet_connection_type} onChange={(v) => set("internet_connection_type", v)} options={InternetConnectionTypes} />

            <div className="admin-form-row">
              <TextField label="Poskytovatel internetu" value={form.internet_connection_provider} onChange={(v) => set("internet_connection_provider", v)} placeholder={"nap\u0159. O2, UPC"} />
              <NumberField label="Rychlost internetu" value={form.internet_connection_speed} onChange={(v) => set("internet_connection_speed", v)} suffix="Mbps" />
            </div>

            <div className="admin-form-row">
              <SelectField label={"Typ z\u00e1stavby"} value={form.surroundings_type} onChange={(v) => set("surroundings_type", v)} options={SurroundingsTypes} />
              <SelectField label="Ochrana" value={form.protection} onChange={(v) => set("protection", v)} options={ProtectionTypes} />
            </div>
            <div className="admin-form-row">
              <SelectField label={"Jisti\u010d"} value={form.circuit_breaker} onChange={(v) => set("circuit_breaker", v)} options={CircuitBreakers} />
              <SelectField label={"F\u00e1ze"} value={form.phase_distribution} onChange={(v) => set("phase_distribution", v)} options={PhaseDistributions} />
            </div>
            <MultiSelectField label={"Typ studny"} value={form.well_type} onChange={(v) => set("well_type", v)} options={WellTypes} />

            <h4 className="pf-subtitle">{"Finan\u010dn\u00ed \u00fadaje"}</h4>
            <div className="admin-form-row">
              <NumberField label={"Anuita / m\u011bs\u00ed\u010dn\u00ed spl\u00e1tka"} value={form.annuity} onChange={(v) => set("annuity", v)} suffix={"K\u010d"} />
              <TextField label={"N\u00e1klady na bydlen\u00ed"} value={form.cost_of_living} onChange={(v) => set("cost_of_living", v)} placeholder={"nap\u0159. 5 000 K\u010d/m\u011bs\u00edc"} />
            </div>
            <div className="admin-form-row">
              <NumberField label="Provize" value={form.commission} onChange={(v) => set("commission", v)} suffix={"K\u010d"} />
              <NumberField label={"Procento hypot\u00e9ky"} value={form.mortgage_percent} onChange={(v) => set("mortgage_percent", v)} suffix="%" />
            </div>
            <div className="admin-form-row">
              <NumberField label={"Procento spo\u0159en\u00ed"} value={form.spor_percent} onChange={(v) => set("spor_percent", v)} suffix="%" />
              <NumberField label={"Vratn\u00e1 kauce"} value={form.refundable_deposit} onChange={(v) => set("refundable_deposit", v)} suffix={"K\u010d"} />
            </div>

            <h4 className="pf-subtitle">{"Pron\u00e1jem / Dra\u017eba / Pod\u00edly"}</h4>
            <div className="pf-conditional">
              <h4 className="pf-subtitle">{"Pron\u00e1jem"}</h4>
              <p className="pf-hint">{"Relevantn\u00ed pro typ nab\u00eddky: Pron\u00e1jem"}</p>
              <div className="admin-form-row">
                <SelectField label={"Typ pron\u00e1jmu"} value={form.lease_type} onChange={(v) => set("lease_type", v)} options={LeaseTypes} />
                <CheckboxField label={"N\u00e1jemce neplat\u00ed provizi"} checked={form.tenant_not_pay_commission} onChange={(v) => set("tenant_not_pay_commission", v)} />
              </div>
              <TextField label={"Datum nast\u011bhov\u00e1n\u00ed"} value={form.ready_date} onChange={(v) => set("ready_date", v)} type="date" />
            </div>

            <div className="pf-conditional">
              <h4 className="pf-subtitle">{"Dra\u017eba"}</h4>
              <p className="pf-hint">{"Relevantn\u00ed pro typ nab\u00eddky: Dra\u017eba"}</p>
              <div className="admin-form-row">
                <SelectField label={"Druh dra\u017eby"} value={form.auction_kind} onChange={(v) => set("auction_kind", v)} options={AuctionKinds} />
                <TextField label={"Datum dra\u017eby"} value={form.auction_date} onChange={(v) => set("auction_date", v)} type="date" />
              </div>
              <TextField label={"M\u00edsto dra\u017eby"} value={form.auction_place} onChange={(v) => set("auction_place", v)} placeholder={"Adresa m\u00edsta dra\u017eby"} />
              <div className="admin-form-row">
                <NumberField label="Jistina" value={form.price_auction_principal} onChange={(v) => set("price_auction_principal", v)} suffix={"K\u010d"} />
                <NumberField label={"Cena znaleck\u00e9ho posudku"} value={form.price_expert_report} onChange={(v) => set("price_expert_report", v)} suffix={"K\u010d"} />
              </div>
              <NumberField label={"Nejni\u017e\u0161\u00ed pod\u00e1n\u00ed"} value={form.price_minimum_bid} onChange={(v) => set("price_minimum_bid", v)} suffix={"K\u010d"} />
            </div>

            <div className="pf-conditional">
              <h4 className="pf-subtitle">{"Pod\u00edly"}</h4>
              <p className="pf-hint">{"Relevantn\u00ed pro typ nab\u00eddky: Pod\u00edly"}</p>
              <div className="admin-form-row">
                <NumberField label={"\u010citatel pod\u00edlu"} value={form.share_numerator} onChange={(v) => set("share_numerator", v)} placeholder={"nap\u0159. 1"} />
                <NumberField label={"Jmenovatel pod\u00edlu"} value={form.share_denominator} onChange={(v) => set("share_denominator", v)} placeholder={"nap\u0159. 4"} />
              </div>
            </div>

            <h4 className="pf-subtitle">Datumy a status</h4>
            <div className="admin-form-row">
              <TextField label={"Za\u010d\u00e1tek v\u00fdstavby"} value={form.beginning_date} onChange={(v) => set("beginning_date", v)} type="date" />
              <TextField label={"Konec v\u00fdstavby"} value={form.finish_date} onChange={(v) => set("finish_date", v)} type="date" />
            </div>
            <div className="admin-form-row">
              <TextField label="Datum prodeje" value={form.sale_date} onChange={(v) => set("sale_date", v)} type="date" />
              <TextField label={"Prvn\u00ed prohl\u00eddka"} value={form.first_tour_date} onChange={(v) => set("first_tour_date", v)} type="date" />
            </div>
            <div className="admin-form-row">
              <SelectField label="Stav" value={form.extra_info} onChange={(v) => set("extra_info", v)} options={ExtraInfoStatuses} />
              <SelectField label={"P\u0159evod do OV"} value={form.personal_transfer} onChange={(v) => set("personal_transfer", v)} options={PersonalTransferTypes} />
            </div>
            <div className="admin-form-row">
              <CheckboxField label={"Exkluzivn\u011b u RK"} checked={form.exclusively_at_rk} onChange={(v) => set("exclusively_at_rk", v)} />
              <NumberField label={"Po\u010det vlastn\u00edk\u016f"} value={form.num_owners} onChange={(v) => set("num_owners", v)} />
            </div>
            <NumberField label={"C\u00edslo bytov\u00e9 jednotky"} value={form.apartment_number} onChange={(v) => set("apartment_number", v)} />

            <h4 className="pf-subtitle">{"Kl\u00ed\u010dov\u00e1 slova"}</h4>
            <TagsField
              label={"Kl\u00ed\u010dov\u00e1 slova"}
              value={form.keywords}
              onChange={(v) => set("keywords", v)}
              placeholder={"P\u0159idat kl\u00ed\u010dov\u00e9 slovo..."}
            />

            <h4 className="pf-subtitle">{"Makl\u00e9\u0159 a publikace"}</h4>
            {!brokerMode ? (
              /* Admin mode: full broker list */
              <div className="admin-form-group">
                <label>{"P\u0159i\u0159azen\u00fd makl\u00e9\u0159"}</label>
                <select value={form.broker_id} onChange={(e) => set("broker_id", e.target.value)}>
                  <option value="">{"-- Bez makl\u00e9\u0159e --"}</option>
                  {brokers.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            ) : agencyBrokers && agencyBrokers.length > 1 ? (
              /* Broker mode with agency team: show team brokers */
              <div className="admin-form-group">
                <label>{"P\u0159i\u0159adit makl\u00e9\u0159i"}</label>
                <select value={form.broker_id} onChange={(e) => set("broker_id", e.target.value)}>
                  {agencyBrokers.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            ) : null /* Solo broker: broker_id auto-assigned, no selector */}
            <div className="admin-form-group">
              <label>Projekt</label>
              <select value={form.project_id} onChange={(e) => set("project_id", e.target.value)}>
                <option value="">-- Bez projektu --</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="pf-checkbox-grid" style={{ marginTop: 16 }}>
              <CheckboxField label={"Aktivn\u00ed (zobrazit na webu)"} checked={form.active} onChange={(v) => set("active", v)} />
              <CheckboxField label={"Doporu\u010den\u00e1 (premium)"} checked={form.featured} onChange={(v) => set("featured", v)} />
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
            {mode === "create" ? "Vytvo\u0159it nemovitost" : "Ulo\u017eit zm\u011bny"}
          </button>
        </div>
      </div>

      {/* Live preview */}
      <LivePreview form={form} />
    </div>
  );
}
