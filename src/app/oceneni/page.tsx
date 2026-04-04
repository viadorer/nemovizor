"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { LocationSearch } from "@/components/location-search";
import { useEffect } from "react";
import { getUniqueCities } from "@/lib/api";
import { useT } from "@/i18n/provider";
import { track } from "@/lib/analytics";
import { brand } from "@/brands";
import { useAuth } from "@/components/auth-provider";

const ALL_STEPS = [
  { id: 0, key: "propertyType" },
  { id: 1, key: "location" },
  { id: 2, key: "disposition" },
  { id: 3, key: "area" },
  { id: 4, key: "condition" },
  { id: 5, key: "age" },
  { id: 6, key: "floor" },
  { id: 7, key: "equipment" },
  { id: 8, key: "ownership" },
  { id: 9, key: "contact" },
];

const dispositionsByType: Record<string, string[]> = {
  apartment: ["1+kk", "1+1", "2+kk", "2+1", "3+kk", "3+1", "4+kk", "4+1", "5+kk", "5+1", "6+"],
  house: ["3+kk", "3+1", "4+kk", "4+1", "5+kk", "5+1", "6+kk", "6+1", "7+"],
  land: [],
  commercial: [],
};

const energyRatings = ["A", "B", "C", "D", "E", "F", "G"];

type ValuationResult = {
  avg_price: number;
  min_price: number;
  max_price: number;
  avg_price_m2: number;
  range_price: [number, number];
  currency: string;
  calc_area: number;
  as_of: string;
};

type FormData = {
  propertyType: "apartment" | "house" | "land" | "commercial" | null;
  city: string;
  address: string;
  lat: number;
  lng: number;
  disposition: string;
  area: string;
  areaLand: string;
  condition: string;
  yearBuilt: string;
  floor: string;
  totalFloors: string;
  features: string[];
  ownership: string;
  energyRating: string;
  landType: string;
  name: string;
  lastName: string;
  email: string;
  phone: string;
  consent: boolean;
};

function getVisibleSteps(type: FormData["propertyType"]): number[] {
  const all = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  if (!type) return [0];
  if (type === "apartment") return all;
  if (type === "house") return all.filter((s) => s !== 6); // no floor step
  if (type === "land") return all.filter((s) => s !== 2 && s !== 6); // no disposition, no floor
  if (type === "commercial") return all.filter((s) => s !== 2); // no disposition
  return all;
}

export default function ValuationPage() {
  const t = useT();
  const { user } = useAuth();

  const propertyTypes = useMemo(() => [
    {
      value: "apartment" as const,
      label: t.sell.typeApartment,
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <path d="M9 22V12h6v10M8 6h2M14 6h2M8 10h2M14 10h2" />
        </svg>
      ),
    },
    {
      value: "house" as const,
      label: t.sell.typeHouse,
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <path d="M9 22V12h6v10" />
        </svg>
      ),
    },
    {
      value: "land" as const,
      label: t.sell.typeLand,
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2 22L12 2l10 20H2z" />
          <path d="M7 22l5-10 5 10" />
        </svg>
      ),
    },
    {
      value: "commercial" as const,
      label: t.sell.typeCommercial,
      icon: (
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 21h18M3 7v14M21 7v14M6 11h4M6 15h4M14 11h4M14 15h4M9 21v-4h6v4M12 3l9 4H3l9-4z" />
        </svg>
      ),
    },
  ], [t]);

  const conditions = useMemo(() => [
    { value: "new", label: t.valuation.conditionNew, icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2l3 7h7l-5.5 4.5 2 7L12 16l-6.5 4.5 2-7L2 9h7z" />
      </svg>
    )},
    { value: "renovated", label: t.valuation.conditionRenovated, icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    )},
    { value: "very-good", label: t.valuation.conditionVeryGood, icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
        <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
      </svg>
    )},
    { value: "good", label: t.valuation.conditionGood, icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" />
        <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
      </svg>
    )},
    { value: "before-renovation", label: t.valuation.conditionBeforeRenovation, icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    )},
    { value: "bad", label: t.valuation.conditionBad, icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" />
        <path d="M16 16s-1.5-2-4-2-4 2-4 2M9 9h.01M15 9h.01" />
      </svg>
    )},
  ], [t]);

  const featureOptions = useMemo(() => [
    t.valuation.featureBalcony, t.valuation.featureTerrace, t.valuation.featureGarden,
    t.valuation.featureCellar, t.valuation.featureGarage, t.valuation.featureElevator,
    t.valuation.featureParking, t.valuation.featurePool, t.valuation.featureAC,
    t.valuation.featureLoggia,
  ], [t]);

  const ownershipOptions = useMemo(() => [
    t.valuation.ownershipPersonal, t.valuation.ownershipCooperative, t.valuation.ownershipState,
  ], [t]);

  const landTypes = useMemo(() => [
    t.valuation.landTypeBuilding, t.valuation.landTypeAgricultural,
    t.valuation.landTypeForest, t.valuation.landTypeOther,
  ], [t]);

  const floorOptions = useMemo(() => [
    t.valuation.floorBasement, t.valuation.floorGround,
    ...Array.from({ length: 9 }, (_, i) => t.valuation.floorN.replace("{n}", String(i + 1))),
    t.valuation.floorAndAbove,
  ], [t]);

  const [stepId, setStepId] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState<FormData>({
    propertyType: null,
    city: "",
    address: "",
    lat: 0,
    lng: 0,
    disposition: "",
    area: "",
    areaLand: "",
    condition: "",
    yearBuilt: "",
    floor: "",
    totalFloors: "",
    features: [],
    ownership: "",
    energyRating: "",
    landType: "",
    name: "",
    lastName: "",
    email: "",
    phone: "",
    consent: false,
  });

  const [valuationResult, setValuationResult] = useState<ValuationResult | null>(null);
  const [lastValuationId, setLastValuationId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportPdfUrl, setReportPdfUrl] = useState<string | null>(null);

  const [cities, setCities] = useState<string[]>([]);
  useEffect(() => { getUniqueCities().then(setCities); }, []);
  const visibleSteps = useMemo(() => getVisibleSteps(form.propertyType), [form.propertyType]);
  const currentIndex = visibleSteps.indexOf(stepId);
  const totalSteps = visibleSteps.length;
  const progressPercent = totalSteps > 1 ? (currentIndex / (totalSteps - 1)) * 100 : 0;

  function updateForm(updates: Partial<FormData>) {
    setForm((prev) => ({ ...prev, ...updates }));
  }

  function toggleFeature(feat: string) {
    setForm((prev) => ({
      ...prev,
      features: prev.features.includes(feat)
        ? prev.features.filter((f) => f !== feat)
        : [...prev.features, feat],
    }));
  }

  function nextStep() {
    const idx = visibleSteps.indexOf(stepId);
    if (idx < visibleSteps.length - 1) {
      setStepId(visibleSteps[idx + 1]);
    }
  }

  function prevStep() {
    const idx = visibleSteps.indexOf(stepId);
    if (idx > 0) {
      setStepId(visibleSteps[idx - 1]);
    }
  }

  function canProceed(): boolean {
    switch (stepId) {
      case 0: return form.propertyType !== null;
      case 1: return form.lat > 0 && form.lng > 0;
      case 2: return form.disposition.length > 0;
      case 3: return form.area.length > 0;
      case 4: return form.condition.length > 0;
      case 5: return true; // optional
      case 6: return form.floor.length > 0;
      case 7: return true; // optional
      case 8: return form.propertyType === "land" ? form.landType.length > 0 : form.ownership.length > 0;
      case 9: return form.name.length > 0 && form.lastName.length > 0 && form.email.length > 0 && form.phone.length > 0 && form.consent;
      default: return false;
    }
  }

  async function handleSubmit() {
    if (!canProceed()) return;

    // Validate email
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setSubmitError("Zadejte platný email");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    track("valuation_submit", {
      property_type: form.propertyType ?? "",
      city: form.city,
      disposition: form.disposition,
      area: form.area ?? 0,
    });

    // Map wizard values to Valuo API codes
    const conditionMap: Record<string, string> = {
      "new": "excellent", "very-good": "very_good", "good": "good", "average": "nothing_much", "before-renovation": "bad", "bad": "bad",
    };
    const typeMap: Record<string, string> = {
      apartment: "flat", house: "house", land: "land", commercial: "flat",
    };
    const ownershipMap: Record<string, string> = {
      [t.valuation.ownershipPersonal]: "private",
      [t.valuation.ownershipCooperative]: "cooperative",
      [t.valuation.ownershipState]: "council",
      "Osobní": "private", "Družstevní": "cooperative", "Státní/obecní": "council",
    };
    const landTypeMap: Record<string, string> = {
      [t.valuation.landTypeBuilding]: "building",
      [t.valuation.landTypeAgricultural]: "field",
      [t.valuation.landTypeForest]: "forest",
      [t.valuation.landTypeOther]: "other",
      "Stavební": "building", "Zemědělský": "field", "Lesní": "forest", "Ostatní": "other",
    };

    try {
      const res = await fetch("/api/valuation/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyType: typeMap[form.propertyType || "apartment"] || "flat",
          lat: form.lat || undefined,
          lng: form.lng || undefined,
          floorArea: Number(form.area) || undefined,
          lotArea: Number(form.areaLand) || undefined,
          rating: conditionMap[form.condition] || "good",
          kind: "sale",
          localType: form.disposition || undefined,
          ownership: ownershipMap[form.ownership] || form.ownership || "private",
          landType: landTypeMap[form.landType] || form.landType || undefined,
          houseType: form.propertyType === "house" ? "family_house" : undefined,
          floor: form.floor ? Number(form.floor) : undefined,
          totalFloors: form.totalFloors ? Number(form.totalFloors) : undefined,
          elevator: form.features.includes("elevator"),
          energyPerformance: form.energyRating || undefined,
          balconyArea: form.features.includes("balcony") ? 5 : undefined,
          cellarArea: form.features.includes("cellar") ? 5 : undefined,
          gardenArea: form.features.includes("garden") ? 50 : undefined,
          terraceArea: form.features.includes("terrace") ? 10 : undefined,
          garages: form.features.includes("garage") ? 1 : 0,
          rooms: form.disposition ? parseInt(form.disposition) || undefined : undefined,
          email: form.email,
          name: form.name,
          lastName: form.lastName,
          phone: form.phone,
          address: form.address,
          city: form.city,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Chyba při ocenění");
      }

      const data = await res.json();
      if (data.success && data.result) {
        setValuationResult(data.result);
      }
      if (data.valuationId) {
        setLastValuationId(data.valuationId);
      }
      setSubmitted(true);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Chyba při ocenění");
    } finally {
      setSubmitting(false);
    }
  }

  const isLastStep = currentIndex === totalSteps - 1;

  const fmtPrice = (n: number) => n ? `${Math.round(n).toLocaleString("cs")} Kč` : "—";

  if (submitted) {
    return (
      <div className="page-shell">
        <SiteHeader />
        <main style={{ paddingTop: 96, minHeight: "100vh", background: "var(--bg)" }}>
          <div className="container">
            <div className="valuation-wizard">
              <div className="valuation-success">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <path d="M22 4L12 14.01l-3-3" />
                </svg>

                <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: 16, color: "var(--text)" }}>
                  Děkujeme za váš zájem
                </h2>

                <p style={{ color: "var(--text-secondary)", marginTop: 12, lineHeight: 1.7, maxWidth: 460, margin: "12px auto 0" }}>
                  Výsledek orientačního ocenění byl odeslán na <strong>{form.email}</strong>.
                  Zkontrolujte prosím svou e-mailovou schránku.
                </p>

                {/* Detailní PDF report */}
                <div style={{ marginTop: 32, padding: "28px 28px", background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border)", maxWidth: 500, marginLeft: "auto", marginRight: "auto", textAlign: "center" }}>
                  <div style={{ fontWeight: 700, fontSize: "1.1rem", marginBottom: 8 }}>
                    Detailní PDF report
                  </div>
                  <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: 20, lineHeight: 1.6 }}>
                    Kompletní analýza s AI komentářem, katastrálními daty a porovnáním s okolím ke stažení ihned.
                  </p>

                  {reportPdfUrl ? (
                    <a href={reportPdfUrl} target="_blank" rel="noopener" className="valuation-btn valuation-btn--primary" style={{ textDecoration: "none", display: "inline-block" }}>
                      Stáhnout PDF report
                    </a>
                  ) : !lastValuationId ? (
                    <p style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>Report není dostupný — zkuste ocenění znovu.</p>
                  ) : (
                    <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                      {/* Peněženka (přihlášený) */}
                      {user && (
                        <button
                          className="valuation-btn valuation-btn--primary"
                          disabled={reportLoading}
                          onClick={async () => {
                            setReportLoading(true);
                            try {
                              const res = await fetch("/api/valuation/report", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ valuationId: lastValuationId, userId: user.id }),
                              });
                              const data = await res.json();
                              if (data.pdf_url) { setReportPdfUrl(data.pdf_url); window.open(data.pdf_url, "_blank"); }
                              else if (data.error) alert(data.error);
                            } catch { /* ignore */ }
                            setReportLoading(false);
                          }}
                        >
                          {reportLoading ? "Generuji..." : "Získat za 50 kr"}
                        </button>
                      )}
                      {/* Stripe (vždy) */}
                      <button
                        className="valuation-btn"
                        disabled={reportLoading}
                        style={{ border: "1px solid var(--border)", background: "var(--bg)" }}
                        onClick={async () => {
                          setReportLoading(true);
                          try {
                            const res = await fetch("/api/valuation/checkout", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ valuationId: lastValuationId, email: form.email }),
                            });
                            const data = await res.json();
                            if (data.url) window.location.href = data.url;
                          } catch { /* ignore */ }
                          setReportLoading(false);
                        }}
                      >
                        {reportLoading ? "Připravuji..." : "Zaplatit 99 Kč kartou"}
                      </button>
                    </div>
                  )}
                </div>

                <Link href="/nabidky" className="valuation-btn valuation-btn--primary" style={{ display: "inline-block", marginTop: 24, textDecoration: "none" }}>
                  {t.valuation.backToListings}
                </Link>
              </div>
            </div>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <SiteHeader />
      <main style={{ paddingTop: 96, minHeight: "100vh", background: "var(--bg)" }}>
        <div className="container">
          <div className="valuation-wizard">
            <h1 className="section-title" style={{ fontSize: "1.8rem", marginBottom: 8, textAlign: "center" }}>
              {t.valuation.title}
            </h1>
            <p style={{ color: "var(--text-muted)", textAlign: "center", marginBottom: 32 }}>
              {t.valuation.subtitle}
            </p>

            {/* Progress bar */}
            <div className="valuation-progress-text">
              {t.valuation.stepOf.replace("{current}", String(currentIndex + 1)).replace("{total}", String(totalSteps))}
            </div>
            <div className="valuation-progress-bar">
              <div
                className="valuation-progress-fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Step 1: Property type */}
            {stepId === 0 && (
              <div className="valuation-step">
                <h2 className="valuation-step-title">{t.valuation.whatToValuate}</h2>
                <div className="valuation-type-grid">
                  {propertyTypes.map((pt) => (
                    <button
                      key={pt.value}
                      className={`valuation-type-card ${form.propertyType === pt.value ? "valuation-type-card--selected" : ""}`}
                      onClick={() => {
                        updateForm({ propertyType: pt.value, disposition: "", floor: "", totalFloors: "", landType: "" });
                        const next = getVisibleSteps(pt.value);
                        setStepId(next[1]);
                      }}
                    >
                      {pt.icon}
                      <span>{pt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Location */}
            {stepId === 1 && (
              <div className="valuation-step">
                <h2 className="valuation-step-title">{t.valuation.whereIsProperty}</h2>
                <div className="valuation-field">
                  <label>Adresa nemovitosti</label>
                  <LocationSearch
                    placeholder="Zadejte ulici, město nebo adresu..."
                    initialValue={form.address}
                    onSelect={(item) => {
                      updateForm({
                        address: item.name + (item.location ? `, ${item.location}` : ""),
                        city: item.city || item.district || "",
                        lat: item.lat || 0,
                        lng: item.lon || 0,
                      });
                    }}
                  />
                  {form.address && form.lat > 0 && (
                    <div style={{ marginTop: 8, fontSize: "0.82rem", color: "var(--text-muted)" }}>
                      {form.city && <span>{form.city} · </span>}
                      <span>GPS: {form.lat.toFixed(5)}, {form.lng.toFixed(5)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Disposition */}
            {stepId === 2 && (
              <div className="valuation-step">
                <h2 className="valuation-step-title">{t.valuation.whatDisposition}</h2>
                <div className="valuation-disposition-grid">
                  {(dispositionsByType[form.propertyType || ""] || []).map((d) => (
                    <button
                      key={d}
                      className={`valuation-disposition-card ${form.disposition === d ? "valuation-disposition-card--selected" : ""}`}
                      onClick={() => { updateForm({ disposition: d }); nextStep(); }}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4: Area */}
            {stepId === 3 && (
              <div className="valuation-step">
                <h2 className="valuation-step-title">{t.valuation.whatArea}</h2>
                <div className="valuation-field">
                  <label>
                    {form.propertyType === "land" ? t.valuation.landArea :
                     form.propertyType === "house" ? t.valuation.usableAreaHouse :
                     t.valuation.usableAreaApartment}
                  </label>
                  <input
                    className="valuation-input"
                    type="number"
                    placeholder={t.valuation.exampleArea}
                    value={form.area}
                    onChange={(e) => updateForm({ area: e.target.value })}
                  />
                </div>
                {form.propertyType === "house" && (
                  <div className="valuation-field">
                    <label>{t.valuation.landArea}</label>
                    <input
                      className="valuation-input"
                      type="number"
                      placeholder={t.valuation.exampleLandArea}
                      value={form.areaLand}
                      onChange={(e) => updateForm({ areaLand: e.target.value })}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Step 5: Condition */}
            {stepId === 4 && (
              <div className="valuation-step">
                <h2 className="valuation-step-title">{t.valuation.whatCondition}</h2>
                <div className="valuation-condition-grid">
                  {conditions.map((c) => (
                    <button
                      key={c.value}
                      className={`valuation-condition-card ${form.condition === c.value ? "valuation-condition-card--selected" : ""}`}
                      onClick={() => { updateForm({ condition: c.value }); nextStep(); }}
                    >
                      {c.icon}
                      <span>{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 6: Year built */}
            {stepId === 5 && (
              <div className="valuation-step">
                <h2 className="valuation-step-title">{t.valuation.whenBuilt}</h2>
                <div className="valuation-field">
                  <label>{t.valuation.yearBuiltLabel}</label>
                  <input
                    className="valuation-input"
                    type="number"
                    placeholder={t.valuation.exampleYear}
                    value={form.yearBuilt}
                    onChange={(e) => updateForm({ yearBuilt: e.target.value })}
                  />
                </div>
                <button
                  className="valuation-skip-btn"
                  onClick={nextStep}
                >
                  {t.valuation.skipUnknown}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}

            {/* Step 7: Floor */}
            {stepId === 6 && (
              <div className="valuation-step">
                <h2 className="valuation-step-title">
                  {form.propertyType === "apartment" ? t.valuation.whatFloor : t.valuation.howManyFloors}
                </h2>
                {form.propertyType === "apartment" && (
                  <div className="valuation-field">
                    <label>{t.valuation.apartmentFloor}</label>
                    <select
                      className="valuation-input"
                      value={form.floor}
                      onChange={(e) => updateForm({ floor: e.target.value })}
                    >
                      <option value="">{t.valuation.selectFloor}</option>
                      {floorOptions.map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="valuation-field">
                  <label>{form.propertyType === "apartment" ? t.valuation.totalFloorsInBuilding : t.valuation.numberOfFloors}</label>
                  <input
                    className="valuation-input"
                    type="number"
                    placeholder={t.valuation.exampleFloors}
                    value={form.totalFloors}
                    onChange={(e) => updateForm({ totalFloors: e.target.value })}
                  />
                </div>
              </div>
            )}

            {/* Step 8: Features */}
            {stepId === 7 && (
              <div className="valuation-step">
                <h2 className="valuation-step-title">{t.valuation.whatFeatures}</h2>
                <div className="valuation-checkbox-grid">
                  {featureOptions.map((feat) => (
                    <label key={feat} className="valuation-checkbox">
                      <input
                        type="checkbox"
                        checked={form.features.includes(feat)}
                        onChange={() => toggleFeature(feat)}
                      />
                      <span>{feat}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Step 9: Ownership / Land type */}
            {stepId === 8 && (
              <div className="valuation-step">
                <h2 className="valuation-step-title">{t.valuation.additionalInfo}</h2>
                {form.propertyType === "land" ? (
                  <div className="valuation-field">
                    <label>{t.valuation.landTypeLabel}</label>
                    <div className="valuation-disposition-grid">
                      {landTypes.map((lt) => (
                        <button
                          key={lt}
                          className={`valuation-disposition-card ${form.landType === lt ? "valuation-disposition-card--selected" : ""}`}
                          onClick={() => updateForm({ landType: lt })}
                        >
                          {lt}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="valuation-field">
                      <label>{t.valuation.ownershipType}</label>
                      <select
                        className="valuation-input"
                        value={form.ownership}
                        onChange={(e) => updateForm({ ownership: e.target.value })}
                      >
                        <option value="">{t.valuation.selectOption}</option>
                        {ownershipOptions.map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    </div>
                    <div className="valuation-field">
                      <label>{t.valuation.energyLabel}</label>
                      <select
                        className="valuation-input"
                        value={form.energyRating}
                        onChange={(e) => updateForm({ energyRating: e.target.value })}
                      >
                        <option value="">{t.valuation.energyNotSet}</option>
                        {energyRatings.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Step 10: Contact */}
            {stepId === 9 && (
              <div className="valuation-step">
                <h2 className="valuation-step-title">{t.valuation.whereToSend}</h2>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="valuation-field">
                    <label>Jméno *</label>
                    <input
                      className="valuation-input"
                      type="text"
                      placeholder="Jan"
                      value={form.name}
                      onChange={(e) => updateForm({ name: e.target.value })}
                    />
                  </div>
                  <div className="valuation-field">
                    <label>Příjmení *</label>
                    <input
                      className="valuation-input"
                      type="text"
                      placeholder="Novák"
                      value={form.lastName}
                      onChange={(e) => updateForm({ lastName: e.target.value })}
                    />
                  </div>
                </div>
                <div className="valuation-field">
                  <label>{t.sell.contactEmail}</label>
                  <input
                    className="valuation-input"
                    type="email"
                    placeholder="jan@email.cz"
                    value={form.email}
                    onChange={(e) => updateForm({ email: e.target.value })}
                  />
                </div>
                <div className="valuation-field">
                  <label>{t.sell.contactPhone}</label>
                  <input
                    className="valuation-input"
                    type="tel"
                    placeholder="+420 777 111 222"
                    value={form.phone}
                    onChange={(e) => updateForm({ phone: e.target.value })}
                  />
                </div>
                <label className="valuation-checkbox" style={{ marginTop: 16 }}>
                  <input
                    type="checkbox"
                    checked={form.consent}
                    onChange={(e) => updateForm({ consent: e.target.checked })}
                  />
                  <span>{t.valuation.consentLabel}</span>
                </label>
              </div>
            )}

            {/* Navigation buttons */}
            {stepId > 0 && (
              <div className="valuation-nav">
                <button className="valuation-btn" onClick={prevStep}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                  {t.valuation.back}
                </button>
                <div style={{ flex: 1 }} />
                {!isLastStep ? (
                  <button
                    className="valuation-btn valuation-btn--primary"
                    disabled={!canProceed()}
                    onClick={nextStep}
                  >
                    {t.valuation.continue}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </button>
                ) : (
                  <button
                    className="valuation-btn valuation-btn--primary"
                    disabled={!canProceed() || submitting}
                    onClick={handleSubmit}
                  >
                    {submitting ? "Oceňuji..." : t.valuation.submitAndGetValuation}
                  </button>
                )}
                {submitError && (
                  <div style={{ color: "#ef4444", fontSize: "0.82rem", marginTop: 8, textAlign: "center", width: "100%" }}>
                    {submitError}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
