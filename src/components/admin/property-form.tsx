"use client";

import { useState, useEffect, useCallback, useMemo, useRef, DragEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import {
  ListingTypes,
  PropertyCategories,
  ApartmentSubtypes,
  HouseSubtypes,
  LandSubtypes,
  CommercialSubtypes,
  OtherSubtypes,
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
  type PropertyCategory,
} from "@/lib/types";

// ===== FORM DATA TYPE (mirrors DB columns exactly) =====
type PropertyFormData = {
  // Basic
  slug: string;
  title: string;
  listing_type: string;
  category: string;
  subtype: string;
  rooms_label: string;

  // Price
  price: number;
  price_note: string;
  price_currency: string;
  price_unit: string;
  price_negotiation: boolean;

  // Location
  city: string;
  district: string;
  street: string;
  zip: string;
  region: string;
  city_part: string;
  location_label: string;
  latitude: number;
  longitude: number;

  // Areas
  area: number;
  land_area: number | null;
  built_up_area: number | null;
  floor_area: number | null;
  balcony_area: number | null;
  basin_area: number | null;
  cellar_area: number | null;
  garden_area: number | null;
  loggia_area: number | null;
  terrace_area: number | null;
  nolive_total_area: number | null;
  offices_area: number | null;
  production_area: number | null;
  shop_area: number | null;
  store_area: number | null;
  workshop_area: number | null;

  // Description
  summary: string;
  description: string;

  // Condition & params
  condition: string;
  ownership: string;
  furnishing: string;
  energy_rating: string;
  building_material: string;
  flooring: string;

  // House-specific
  object_type: string;
  object_kind: string;
  object_location: string;
  flat_class: string;

  // Floors
  floor: number | null;
  total_floors: number | null;
  underground_floors: number | null;
  ceiling_height: number | null;

  // Parking
  parking: string;
  parking_spaces: number | null;
  garage_count: number | null;

  // Amenities (booleans)
  balcony: boolean;
  terrace: boolean;
  garden: boolean;
  elevator: boolean;
  cellar: boolean;
  garage: boolean;
  pool: boolean;
  loggia: boolean;
  easy_access: string;
  low_energy: boolean;
  ftv_panels: boolean;
  solar_panels: boolean;
  mortgage: boolean;

  // Heating (arrays)
  heating: string[];
  heating_element: string[];
  heating_source: string[];
  water_heat_source: string[];

  // Infrastructure (arrays)
  electricity: string[];
  gas: string[];
  water: string[];
  gully: string[];
  road_type: string[];
  telecommunication: string[];
  transport: string[];
  internet_connection_type: string[];

  // Internet
  internet_connection_provider: string;
  internet_connection_speed: number | null;

  // Surroundings
  surroundings_type: string;
  protection: string;

  // Electrical
  circuit_breaker: string;
  phase_distribution: string;

  // Well
  well_type: string[];

  // Financial
  annuity: number | null;
  cost_of_living: string;
  commission: number | null;
  mortgage_percent: number | null;
  spor_percent: number | null;
  refundable_deposit: number | null;

  // Lease
  lease_type: string;
  tenant_not_pay_commission: boolean;
  ready_date: string;

  // Auction
  auction_kind: string;
  auction_date: string;
  auction_place: string;
  price_auction_principal: number | null;
  price_expert_report: number | null;
  price_minimum_bid: number | null;

  // Shares
  share_numerator: number | null;
  share_denominator: number | null;

  // Age
  year_built: number | null;
  last_renovation: number | null;
  acceptance_year: number | null;

  // Construction dates
  beginning_date: string;
  finish_date: string;
  sale_date: string;

  // Tour
  first_tour_date: string;

  // Status
  extra_info: string;
  exclusively_at_rk: boolean;
  personal_transfer: string;
  num_owners: number | null;
  apartment_number: number | null;

  // Keywords
  keywords: string[];

  // VR / panorama
  matterport_url: string;
  mapy_panorama_url: string;

  // Media
  image_src: string;
  image_alt: string;
  images: string[];

  // Assignment
  broker_id: string;
  project_id: string;
  featured: boolean;
  active: boolean;
};

const EMPTY_FORM: PropertyFormData = {
  slug: "",
  title: "",
  listing_type: "sale",
  category: "apartment",
  subtype: "",
  rooms_label: "",
  price: 0,
  price_note: "",
  price_currency: "",
  price_unit: "",
  price_negotiation: false,
  city: "",
  district: "",
  street: "",
  zip: "",
  region: "",
  city_part: "",
  location_label: "",
  latitude: 0,
  longitude: 0,
  area: 0,
  land_area: null,
  built_up_area: null,
  floor_area: null,
  balcony_area: null,
  basin_area: null,
  cellar_area: null,
  garden_area: null,
  loggia_area: null,
  terrace_area: null,
  nolive_total_area: null,
  offices_area: null,
  production_area: null,
  shop_area: null,
  store_area: null,
  workshop_area: null,
  summary: "",
  description: "",
  condition: "",
  ownership: "",
  furnishing: "",
  energy_rating: "",
  building_material: "",
  flooring: "",
  object_type: "",
  object_kind: "",
  object_location: "",
  flat_class: "",
  floor: null,
  total_floors: null,
  underground_floors: null,
  ceiling_height: null,
  parking: "",
  parking_spaces: null,
  garage_count: null,
  balcony: false,
  terrace: false,
  garden: false,
  elevator: false,
  cellar: false,
  garage: false,
  pool: false,
  loggia: false,
  easy_access: "",
  low_energy: false,
  ftv_panels: false,
  solar_panels: false,
  mortgage: false,
  heating: [],
  heating_element: [],
  heating_source: [],
  water_heat_source: [],
  electricity: [],
  gas: [],
  water: [],
  gully: [],
  road_type: [],
  telecommunication: [],
  transport: [],
  internet_connection_type: [],
  internet_connection_provider: "",
  internet_connection_speed: null,
  surroundings_type: "",
  protection: "",
  circuit_breaker: "",
  phase_distribution: "",
  well_type: [],
  annuity: null,
  cost_of_living: "",
  commission: null,
  mortgage_percent: null,
  spor_percent: null,
  refundable_deposit: null,
  lease_type: "",
  tenant_not_pay_commission: false,
  ready_date: "",
  auction_kind: "",
  auction_date: "",
  auction_place: "",
  price_auction_principal: null,
  price_expert_report: null,
  price_minimum_bid: null,
  share_numerator: null,
  share_denominator: null,
  year_built: null,
  last_renovation: null,
  acceptance_year: null,
  beginning_date: "",
  finish_date: "",
  sale_date: "",
  first_tour_date: "",
  extra_info: "",
  exclusively_at_rk: false,
  personal_transfer: "",
  num_owners: null,
  apartment_number: null,
  keywords: [],
  matterport_url: "",
  mapy_panorama_url: "",
  image_src: "",
  image_alt: "",
  images: [],
  broker_id: "",
  project_id: "",
  featured: false,
  active: true,
};

// ===== SUBTYPE MAP =====
const SUBTYPE_MAP: Record<string, Record<string, string>> = {
  apartment: ApartmentSubtypes,
  house: HouseSubtypes,
  land: LandSubtypes,
  commercial: CommercialSubtypes,
  other: OtherSubtypes,
};

// ===== HELPERS =====

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatPreviewPrice(price: number, currency?: string): string {
  if (!price) return "Na dotaz";
  const cur = (currency || "czk").toUpperCase();
  const localeMap: Record<string, string> = { CZK: "cs-CZ", EUR: "de-DE", GBP: "en-GB", USD: "en-US" };
  const symbolMap: Record<string, string> = { CZK: "K\u010d", EUR: "\u20ac", GBP: "\u00a3", USD: "$" };
  const locale = localeMap[cur] || "cs-CZ";
  const sym = symbolMap[cur] || "K\u010d";
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(price) + " " + sym;
}

// ===== FIELD COMPONENTS =====

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Record<string, string>;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="admin-form-group">
      <label>
        {label}
        {required && <span className="pf-required">*</span>}
      </label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder ?? `-- Vyberte --`}</option>
        {Object.entries(options).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <div className="admin-form-group">
      <label>
        {label}
        {required && <span className="pf-required">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  placeholder,
  step,
  min,
  suffix,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  step?: string;
  min?: number;
  suffix?: string;
}) {
  return (
    <div className="admin-form-group">
      <label>
        {label}
        {suffix && <span className="pf-suffix"> ({suffix})</span>}
      </label>
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? null : Number(v));
        }}
        placeholder={placeholder}
        step={step ?? "any"}
        min={min}
      />
    </div>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="pf-checkbox">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

function MultiSelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  options: Record<string, string>;
}) {
  function toggle(key: string) {
    if (value.includes(key)) {
      onChange(value.filter((v) => v !== key));
    } else {
      onChange([...value, key]);
    }
  }

  return (
    <div className="admin-form-group">
      <label>{label}</label>
      <div className="pf-multi-select">
        {Object.entries(options).map(([k, v]) => (
          <label key={k} className="pf-multi-option">
            <input
              type="checkbox"
              checked={value.includes(k)}
              onChange={() => toggle(k)}
            />
            <span>{v}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  placeholder,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div className="admin-form-group">
      <label>{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows ?? 4}
      />
    </div>
  );
}

function TagsField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");

  function addTag() {
    const tag = input.trim();
    if (tag && !value.includes(tag)) {
      onChange([...value, tag]);
    }
    setInput("");
  }

  function removeTag(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  return (
    <div className="admin-form-group">
      <label>{label}</label>
      <div className="pf-tags-wrap">
        <div className="pf-tags">
          {value.map((tag, i) => (
            <span key={i} className="pf-tag">
              {tag}
              <button type="button" onClick={() => removeTag(i)}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
        <div className="pf-tags-input">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder={placeholder ?? "P\u0159idat..."}
          />
          <button type="button" className="admin-btn admin-btn--secondary admin-btn--sm" onClick={addTag}>
            +
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== ACCORDION SECTION COMPONENT =====

function AccordionSection({
  title,
  sectionKey,
  openSections,
  toggle,
  children,
}: {
  title: string;
  sectionKey: string;
  openSections: Set<string>;
  toggle: (key: string) => void;
  children: React.ReactNode;
}) {
  const isOpen = openSections.has(sectionKey);
  return (
    <div className={`pf-accordion${isOpen ? " pf-accordion--open" : ""}`}>
      <button
        type="button"
        className="pf-accordion__header"
        onClick={() => toggle(sectionKey)}
        aria-expanded={isOpen}
      >
        <span className="pf-accordion__title">{title}</span>
        <svg
          className="pf-accordion__chevron"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {isOpen && <div className="pf-accordion__body">{children}</div>}
    </div>
  );
}

// ===== ADDRESS AUTOCOMPLETE =====

type MapySuggestion = {
  name: string;
  label: string;
  position: { lat: number; lon: number };
  regionalStructure: { type: string; name: string }[];
};

function AddressAutocomplete({
  onSelect,
  isLand,
}: {
  onSelect: (s: MapySuggestion) => void;
  isLand: boolean;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<MapySuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const apiKey = typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_MAPYCZ_API_KEY ?? "")
    : "";

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleChange(val: string) {
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!apiKey || val.trim().length < 3) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api.mapy.cz/v1/suggest?lang=cs&limit=5&type=regional.address&query=${encodeURIComponent(val)}`,
          { headers: { "X-Mapy-Api-Key": apiKey } }
        );
        if (!res.ok) return;
        const data = await res.json();
        setSuggestions(data.items || []);
        setShowDropdown(true);
      } catch {
        /* silently fail */
      }
    }, 300);
  }

  function handleSelect(s: MapySuggestion) {
    setQuery(s.label);
    setShowDropdown(false);
    onSelect(s);
  }

  if (!apiKey) {
    return (
      <div className="admin-form-group">
        <label>{"Vyhled\u00e1v\u00e1n\u00ed adresy"}</label>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={"Zadejte adresu ru\u010dn\u011b n\u00ed\u017ee..."}
        />
        {isLand && (
          <p className="pf-hint">{"U pozemk\u016f adresa nemus\u00ed existovat \u2014 zadejte \u00fadaje ru\u010dn\u011b."}</p>
        )}
      </div>
    );
  }

  return (
    <div className="admin-form-group pf-address-suggest" ref={wrapRef}>
      <label>
        {"Vyhledat adresu (Mapy.cz)"}
      </label>
      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={"Za\u010dn\u011bte ps\u00e1t adresu..."}
        onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
      />
      {isLand && (
        <p className="pf-hint">{"U pozemk\u016f adresa nemus\u00ed existovat \u2014 zadejte \u00fadaje ru\u010dn\u011b."}</p>
      )}
      {showDropdown && suggestions.length > 0 && (
        <ul className="pf-address-suggest__dropdown">
          {suggestions.map((s, i) => (
            <li key={i}>
              <button type="button" onClick={() => handleSelect(s)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span>{s.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ===== DRAG & DROP IMAGE UPLOAD =====

type UploadingFile = {
  id: string;
  name: string;
  progress: number;
  error?: string;
};

function ImageDropZone({
  images,
  onImagesChange,
  imageSrc,
  onImageSrcChange,
}: {
  images: string[];
  onImagesChange: (v: string[]) => void;
  imageSrc: string;
  onImageSrcChange: (v: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState<UploadingFile[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

  async function uploadFile(file: File): Promise<string | null> {
    if (!ACCEPTED.includes(file.type)) {
      return null;
    }
    if (file.size > MAX_SIZE) {
      return null;
    }

    const id = Math.random().toString(36).slice(2);
    setUploading((prev) => [...prev, { id, name: file.name, progress: 0 }]);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mediaType", "image");

      const xhr = new XMLHttpRequest();
      const url = await new Promise<string | null>((resolve) => {
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setUploading((prev) => prev.map((u) => (u.id === id ? { ...u, progress: pct } : u)));
          }
        });
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              resolve(data.url || null);
            } catch {
              resolve(null);
            }
          } else {
            resolve(null);
          }
        });
        xhr.addEventListener("error", () => resolve(null));
        xhr.open("POST", "/api/upload");
        xhr.send(formData);
      });

      setUploading((prev) => prev.filter((u) => u.id !== id));
      return url;
    } catch {
      setUploading((prev) =>
        prev.map((u) => (u.id === id ? { ...u, error: "Chyba" } : u))
      );
      return null;
    }
  }

  async function handleFiles(files: FileList | File[]) {
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(
      (f) => ACCEPTED.includes(f.type) && f.size <= MAX_SIZE
    );

    const urls: string[] = [];
    for (const file of validFiles) {
      const url = await uploadFile(file);
      if (url) urls.push(url);
    }

    if (urls.length > 0) {
      const newImages = [...images, ...urls];
      onImagesChange(newImages);
      // Auto-set main image if empty
      if (!imageSrc) {
        onImageSrcChange(newImages[0]);
      }
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }

  function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      e.target.value = "";
    }
  }

  function addUrl() {
    const url = urlInput.trim();
    if (url && !images.includes(url)) {
      const newImages = [...images, url];
      onImagesChange(newImages);
      if (!imageSrc) onImageSrcChange(url);
    }
    setUrlInput("");
  }

  function removeImage(idx: number) {
    const removed = images[idx];
    const newImages = images.filter((_, i) => i !== idx);
    onImagesChange(newImages);
    if (imageSrc === removed) {
      onImageSrcChange(newImages[0] || "");
    }
  }

  function moveUp(idx: number) {
    if (idx === 0) return;
    const arr = [...images];
    [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
    onImagesChange(arr);
  }

  function moveDown(idx: number) {
    if (idx === images.length - 1) return;
    const arr = [...images];
    [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
    onImagesChange(arr);
  }

  function setAsMain(url: string) {
    onImageSrcChange(url);
  }

  return (
    <div className="pf-dropzone-wrap">
      {/* Drop zone */}
      <div
        className={`pf-dropzone${dragging ? " pf-dropzone--active" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleFileSelect}
          style={{ display: "none" }}
        />
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <span>{"P\u0159et\u00e1hn\u011bte fotky sem nebo klikn\u011bte pro v\u00fdb\u011br"}</span>
        <span className="pf-dropzone__hint">JPG, PNG, WebP (max 10 MB)</span>
      </div>

      {/* Upload progress */}
      {uploading.length > 0 && (
        <div className="pf-upload-list">
          {uploading.map((u) => (
            <div key={u.id} className="pf-upload-item">
              <span className="pf-upload-name">{u.name}</span>
              {u.error ? (
                <span className="pf-upload-error">{u.error}</span>
              ) : (
                <div className="pf-upload-progress">
                  <div className="pf-upload-progress__bar" style={{ width: `${u.progress}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Gallery thumbnails */}
      {images.length > 0 && (
        <div className="pf-gallery-grid">
          {images.map((url, i) => (
            <div key={i} className={`pf-gallery-item${url === imageSrc ? " pf-gallery-item--main" : ""}`}>
              <img src={url} alt={`Foto ${i + 1}`} />
              {url === imageSrc && (
                <span className="pf-gallery-badge">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </span>
              )}
              <div className="pf-gallery-actions">
                {url !== imageSrc && (
                  <button type="button" onClick={() => setAsMain(url)} title={"Nastavit jako hlavn\u00ed"}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </button>
                )}
                <button type="button" onClick={() => moveUp(i)} disabled={i === 0} title="Nahoru">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18 15l-6-6-6 6" />
                  </svg>
                </button>
                <button type="button" onClick={() => moveDown(i)} disabled={i === images.length - 1} title="Dol\u016f">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                <button type="button" onClick={() => removeImage(i)} title="Odebrat" className="pf-gallery-remove">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* URL fallback input */}
      <div className="pf-tags-input" style={{ marginTop: 8 }}>
        <input
          type="text"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addUrl();
            }
          }}
          placeholder={"Nebo vlo\u017ete URL fotky..."}
        />
        <button type="button" className="admin-btn admin-btn--secondary admin-btn--sm" onClick={addUrl}>
          {"P\u0159idat URL"}
        </button>
      </div>
    </div>
  );
}

// ===== LIVE PREVIEW =====

function LivePreview({ form }: { form: PropertyFormData }) {
  const [collapsed, setCollapsed] = useState(true);
  const listingLabel = ListingTypes[form.listing_type as keyof typeof ListingTypes] || form.listing_type;
  const categoryLabel = PropertyCategories[form.category as PropertyCategory] || form.category;
  const priceStr = formatPreviewPrice(form.price, form.price_currency);

  const card = (
    <div className="pf-preview-card">
      <div className="property-image-wrapper" style={{ position: "relative" }}>
        {form.image_src ? (
          <img
            src={form.image_src}
            alt={form.image_alt || "N\u00e1hled"}
            className="property-image"
            style={{ width: "100%", height: 180, objectFit: "cover", borderRadius: "8px 8px 0 0" }}
          />
        ) : (
          <div className="pf-preview-placeholder">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
        )}
        <span className={`property-badge property-badge--${form.listing_type}`}>
          {listingLabel}
        </span>
      </div>
      <div className="property-info" style={{ padding: "12px" }}>
        <span className="property-price">{priceStr}</span>
        <div className="property-meta">
          <span>{categoryLabel}</span>
          {form.rooms_label && (
            <>
              <span className="property-meta-divider" />
              <span>{form.rooms_label}</span>
            </>
          )}
          {form.area > 0 && (
            <>
              <span className="property-meta-divider" />
              <span>{form.area} m\u00b2</span>
            </>
          )}
        </div>
        {(form.location_label || form.city) && (
          <span className="property-location">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {form.location_label || form.city}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="pf-preview-sidebar">
        <h4 className="pf-preview-sidebar__title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          {"N\u00e1hled"}
        </h4>
        {card}
        {form.title && <p className="pf-preview-title">{form.title}</p>}
      </div>

      {/* Mobile toggle */}
      <div className="pf-preview-mobile">
        <button
          type="button"
          className="pf-preview-mobile__toggle"
          onClick={() => setCollapsed(!collapsed)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          {"N\u00e1hled"}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ transform: collapsed ? "rotate(0deg)" : "rotate(180deg)", transition: "transform 0.2s" }}
          >
            <path d="M18 15l-6-6-6 6" />
          </svg>
        </button>
        {!collapsed && (
          <div className="pf-preview-mobile__body">
            {card}
          </div>
        )}
      </div>
    </>
  );
}

// ===== MAIN COMPONENT =====

type PropertyFormProps = {
  mode: "create" | "edit";
  propertyId?: string;
};

export function PropertyForm({ mode, propertyId }: PropertyFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<PropertyFormData>({ ...EMPTY_FORM });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [brokers, setBrokers] = useState<{ id: string; name: string }[]>([]);
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
      fetch(`/api/admin/properties?id=${propertyId}`)
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

    for (const item of s.regionalStructure) {
      const handler = regionMap[item.type];
      if (handler) handler(item.name);
    }

    // Try to extract ZIP from label (Czech format: 5 digits)
    const zipMatch = s.label.match(/\b(\d{3}\s?\d{2})\b/);
    if (zipMatch) {
      set("zip", zipMatch[1].replace(/\s/g, ""));
    }

    set("latitude", s.position.lat);
    set("longitude", s.position.lon);
  }

  // Build payload
  function buildPayload(): Record<string, unknown> {
    const payload: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(form)) {
      if (value === "" && key !== "title" && key !== "slug" && key !== "summary" && key !== "image_src" && key !== "image_alt") {
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

      const url = "/api/admin/properties";
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
        router.push("/dashboard/sprava/nemovitosti");
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
                onChange={(v) => set("subtype", v)}
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
            <div className="admin-form-group">
              <label>{"P\u0159i\u0159azen\u00fd makl\u00e9\u0159"}</label>
              <select value={form.broker_id} onChange={(e) => set("broker_id", e.target.value)}>
                <option value="">{"-- Bez makl\u00e9\u0159e --"}</option>
                {brokers.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
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
