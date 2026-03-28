"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/provider";
import {
  TextField,
  TextareaField,
  SelectField,
  NumberField,
  TagsField,
} from "@/components/admin/form-fields";
import { SingleImageUpload } from "@/components/admin/single-image-upload";

type BrokerFormProps = {
  mode: "create" | "edit";
  brokerId?: string;
  redirectTo?: string;
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="pf-section">
      <button type="button" className="pf-section-toggle" onClick={() => setOpen(!open)}>
        <span className="pf-section-title">{title}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && <div className="pf-section-content">{children}</div>}
    </div>
  );
}

export function BrokerForm({ mode, brokerId, redirectTo }: BrokerFormProps) {
  const router = useRouter();
  const t = useT();

  // ── Basic ──
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [agencyId, setAgencyId] = useState("");
  const [photo, setPhoto] = useState("");
  const [bio, setBio] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [certifications, setCertifications] = useState<string[]>([]);
  const [yearStarted, setYearStarted] = useState<number | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [activeListings, setActiveListings] = useState<number | null>(null);
  const [totalDeals, setTotalDeals] = useState<number | null>(null);
  const [userId, setUserId] = useState("");
  const [branchId, setBranchId] = useState("");

  // ── Extended profile ──
  const [title, setTitle] = useState("");
  const [motto, setMotto] = useState("");
  const [bioShort, setBioShort] = useState("");
  const [bioLong, setBioLong] = useState("");
  const [education, setEducation] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [hobbies, setHobbies] = useState("");
  const [funFact, setFunFact] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoType, setVideoType] = useState("youtube");
  const [coverPhoto, setCoverPhoto] = useState("");
  const [gallery, setGallery] = useState<string[]>([]);
  const [awards, setAwards] = useState<{ name: string; year?: number }[]>([]);

  // ── Social ──
  const [linkedin, setLinkedin] = useState("");
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [twitter, setTwitter] = useState("");
  const [website, setWebsite] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [calendlyUrl, setCalendlyUrl] = useState("");

  // ── Expertise ──
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [propertyTypes, setPropertyTypes] = useState<string[]>([]);
  const [serviceAreas, setServiceAreas] = useState<string[]>([]); // stored as "City, Country" strings
  const [priceRangeMin, setPriceRangeMin] = useState<number | null>(null);
  const [priceRangeMax, setPriceRangeMax] = useState<number | null>(null);

  // ── Performance ──
  const [totalSalesVolume, setTotalSalesVolume] = useState<number | null>(null);
  const [avgResponseTimeHours, setAvgResponseTimeHours] = useState<number | null>(null);
  const [responseRatePct, setResponseRatePct] = useState<number | null>(null);

  // ── UI state ──
  const [agencies, setAgencies] = useState<Record<string, string>>({});
  const [branches, setBranches] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [slugManual, setSlugManual] = useState(false);

  useEffect(() => {
    if (!slugManual) setSlug(slugify(name));
  }, [name, slugManual]);

  useEffect(() => {
    fetch("/api/admin/agencies?limit=1000")
      .then((r) => r.json())
      .then((res) => {
        if (res.data && Array.isArray(res.data)) {
          const map: Record<string, string> = {};
          for (const a of res.data) map[a.id] = a.name;
          setAgencies(map);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!agencyId) { setBranches({}); setBranchId(""); return; }
    fetch(`/api/admin/branches?agency_id=${agencyId}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.data && Array.isArray(res.data)) {
          const map: Record<string, string> = {};
          for (const b of res.data) map[b.id] = b.name + (b.city ? ` (${b.city})` : "") + (b.is_headquarters ? ` - HQ` : "");
          setBranches(map);
        }
      })
      .catch(() => {});
  }, [agencyId]);

  useEffect(() => {
    if (mode === "edit" && brokerId) {
      setLoading(true);
      fetch(`/api/admin/brokers?id=${brokerId}`)
        .then((r) => r.json())
        .then((res) => {
          if (res.data) {
            const d = res.data;
            // Basic
            setName(d.name || ""); setSlug(d.slug || ""); setEmail(d.email || "");
            setPhone(d.phone || ""); setAgencyId(d.agency_id || ""); setPhoto(d.photo || "");
            setBio(d.bio || ""); setSpecialization(d.specialization || "");
            setLanguages(d.languages || []); setCertifications(d.certifications || []);
            setYearStarted(d.year_started ?? null); setRating(d.rating ?? null);
            setActiveListings(d.active_listings ?? null); setTotalDeals(d.total_deals ?? null);
            setUserId(d.user_id || ""); setBranchId(d.branch_id || "");
            // Extended
            setTitle(d.title || ""); setMotto(d.motto || "");
            setBioShort(d.bio_short || ""); setBioLong(d.bio_long || "");
            setEducation(d.education || ""); setLicenseNumber(d.license_number || "");
            setHobbies(d.hobbies || ""); setFunFact(d.fun_fact || "");
            setVideoUrl(d.video_url || ""); setVideoType(d.video_type || "youtube");
            setCoverPhoto(d.cover_photo || "");
            setGallery(d.gallery || []);
            setAwards(d.awards || []);
            // Social
            setLinkedin(d.linkedin || ""); setInstagram(d.instagram || "");
            setFacebook(d.facebook || ""); setTwitter(d.twitter || "");
            setWebsite(d.website || ""); setWhatsapp(d.whatsapp || "");
            setCalendlyUrl(d.calendly_url || "");
            // Expertise
            setSpecializations(d.specializations || []); setPropertyTypes(d.property_types || []);
            setServiceAreas((d.service_areas || []).map((sa: { city: string; district?: string; country?: string }) =>
              [sa.district, sa.city, sa.country?.toUpperCase()].filter(Boolean).join(", ")
            ));
            setPriceRangeMin(d.price_range_min ?? null); setPriceRangeMax(d.price_range_max ?? null);
            // Performance
            setTotalSalesVolume(d.total_sales_volume ?? null);
            setAvgResponseTimeHours(d.avg_response_time_hours ?? null);
            setResponseRatePct(d.response_rate_pct ?? null);
            setSlugManual(true);
          }
        })
        .catch((err) => setError(err instanceof Error ? err.message : t.admin.loadError))
        .finally(() => setLoading(false));
    }
  }, [mode, brokerId, t]);

  async function handleSubmit() {
    if (!name.trim()) { setError(t.admin.nameRequired); return; }
    if (!slug.trim()) { setError(t.admin.slugRequired); return; }
    setSaving(true); setError(null);

    try {
      const payload: Record<string, unknown> = {
        name: name.trim(), slug: slug.trim(),
        email: email.trim() || "", phone: phone.trim() || "",
        agency_id: agencyId || null, photo: photo.trim() || null,
        bio: bio.trim() || "", specialization: specialization.trim() || "",
        agency_name: "",
        languages: languages.length > 0 ? languages : null,
        certifications: certifications.length > 0 ? certifications : null,
        year_started: yearStarted, rating: rating ?? 0,
        active_listings: activeListings ?? 0, total_deals: totalDeals ?? 0,
        user_id: userId.trim() || null, branch_id: branchId || null,
        // Extended
        title: title.trim() || null, motto: motto.trim() || null,
        bio_short: bioShort.trim() || null, bio_long: bioLong.trim() || null,
        education: education.trim() || null, license_number: licenseNumber.trim() || null,
        hobbies: hobbies.trim() || null, fun_fact: funFact.trim() || null,
        video_url: videoUrl.trim() || null, video_type: videoType || "youtube",
        cover_photo: coverPhoto.trim() || null,
        gallery: gallery.length > 0 ? gallery : null,
        awards: awards.length > 0 ? awards : null,
        // Social
        linkedin: linkedin.trim() || null, instagram: instagram.trim() || null,
        facebook: facebook.trim() || null, twitter: twitter.trim() || null,
        website: website.trim() || null, whatsapp: whatsapp.trim() || null,
        calendly_url: calendlyUrl.trim() || null,
        // Expertise
        specializations: specializations.length > 0 ? specializations : null,
        property_types: propertyTypes.length > 0 ? propertyTypes : null,
        service_areas: serviceAreas.length > 0
          ? serviceAreas.map((s) => { const parts = s.split(",").map((p) => p.trim()); return { city: parts[0] || "", district: parts[1] || "", country: parts[2]?.toLowerCase() || "" }; })
          : null,
        price_range_min: priceRangeMin, price_range_max: priceRangeMax,
        // Performance
        total_sales_volume: totalSalesVolume,
        avg_response_time_hours: avgResponseTimeHours,
        response_rate_pct: responseRatePct,
      };

      if (mode === "edit") payload.id = brokerId;

      const res = await fetch("/api/admin/brokers", {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || t.admin.saveError);
      }
      setSuccess(true);
      setTimeout(() => router.push(redirectTo || "/dashboard/sprava/makleri"), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.admin.saveError);
    } finally { setSaving(false); }
  }

  if (loading) return <div className="pf-loading"><div className="pf-spinner" /><p>{t.admin.loadingData}</p></div>;
  if (success) return (
    <div className="pf-success">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" /></svg>
      <h3>{mode === "create" ? t.admin.brokerCreated : t.admin.brokerSaved}</h3>
      <p>{t.admin.redirecting}</p>
    </div>
  );

  return (
    <div className="pf-main">
      <div className="pf-header">
        <button className="admin-btn admin-btn--secondary" onClick={() => router.push(redirectTo || "/dashboard/sprava/makleri")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          {t.admin.back}
        </button>
        <h2>{mode === "create" ? t.admin.newBroker : t.admin.editBroker}</h2>
      </div>

      {error && (
        <div className="pf-error">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" /></svg>
          {error}
          <button onClick={() => setError(null)} className="pf-error-close">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* ── Základní údaje ── */}
      <Section title="Základní údaje">
        <div className="admin-form-grid">
          <TextField label={t.admin.brokerName} value={name} onChange={setName} placeholder={t.admin.brokerNamePlaceholder} required />
          <TextField label={t.admin.slug} value={slug} onChange={(v) => { setSlug(v); setSlugManual(true); }} placeholder="jan-novak" required />
          <TextField label="Titul / Pozice" value={title} onChange={setTitle} placeholder="Senior realitní makléř" />
          <TextField label={t.admin.email} value={email} onChange={setEmail} placeholder="jan@example.com" type="email" />
          <TextField label={t.admin.phone} value={phone} onChange={setPhone} placeholder="+420 123 456 789" />
          <TextField label="WhatsApp" value={whatsapp} onChange={setWhatsapp} placeholder="+420123456789" />
          <SelectField label={t.admin.agency} value={agencyId} onChange={(v) => { setAgencyId(v); setBranchId(""); }} options={agencies} placeholder={t.admin.agencyPlaceholder} />
          {agencyId && Object.keys(branches).length > 0 && (
            <SelectField label="Pobočka" value={branchId} onChange={setBranchId} options={branches} placeholder="Vyberte pobočku" />
          )}
          <TextField label="User ID (auth)" value={userId} onChange={setUserId} placeholder="UUID přihlášeného uživatele" />
        </div>
        <SingleImageUpload label={t.admin.profilePhoto} value={photo} onChange={setPhoto} shape="round" size={96} />
      </Section>

      {/* ── Profil & Bio ── */}
      <Section title="Profil & Bio" defaultOpen={mode === "edit"}>
        <div className="admin-form-grid">
          <TextField label="Motto" value={motto} onChange={setMotto} placeholder="Vaše profesionální motto..." />
          <TextField label={t.admin.specialization} value={specialization} onChange={setSpecialization} placeholder={t.admin.specializationPlaceholder2} />
          <div className="admin-form-full">
            <TextareaField label="Krátké bio (pro kartičku)" value={bioShort || bio} onChange={(v) => { setBioShort(v); if (!bio) setBio(v); }} placeholder="1-2 věty o vás..." rows={2} />
          </div>
          <div className="admin-form-full">
            <TextareaField label="Podrobné bio" value={bioLong} onChange={setBioLong} placeholder="Vaše profesionální historie, zkušenosti, přístup k práci..." rows={6} />
          </div>
          <TextField label="Vzdělání" value={education} onChange={setEducation} placeholder="VŠE Praha, Ekonomická fakulta" />
          <TextField label="Licence / Registrace" value={licenseNumber} onChange={setLicenseNumber} placeholder="REA-12345" />
          <TextField label="Koníčky" value={hobbies} onChange={setHobbies} placeholder="Golf, cestování, architektura" />
          <TextField label="Fun fact" value={funFact} onChange={setFunFact} placeholder="Navštívil jsem 42 zemí..." />
        </div>
      </Section>

      {/* ── Video ── */}
      <Section title="Video představení" defaultOpen={false}>
        <div className="admin-form-grid">
          <TextField label="Video URL" value={videoUrl} onChange={setVideoUrl} placeholder="https://youtube.com/watch?v=..." />
          <SelectField label="Typ videa" value={videoType} onChange={setVideoType} options={{ youtube: "YouTube", vimeo: "Vimeo", other: "Jiné" }} />
        </div>
      </Section>

      {/* ── Sociální sítě ── */}
      <Section title="Sociální sítě" defaultOpen={false}>
        <div className="admin-form-grid">
          <TextField label="LinkedIn" value={linkedin} onChange={setLinkedin} placeholder="https://linkedin.com/in/..." />
          <TextField label="Instagram" value={instagram} onChange={setInstagram} placeholder="https://instagram.com/..." />
          <TextField label="Facebook" value={facebook} onChange={setFacebook} placeholder="https://facebook.com/..." />
          <TextField label="X (Twitter)" value={twitter} onChange={setTwitter} placeholder="https://x.com/..." />
          <TextField label="Web" value={website} onChange={setWebsite} placeholder="https://..." />
          <TextField label="Calendly (rezervace)" value={calendlyUrl} onChange={setCalendlyUrl} placeholder="https://calendly.com/..." />
        </div>
      </Section>

      {/* ── Odbornost & Oblast ── */}
      <Section title="Odbornost & Oblast působení" defaultOpen={false}>
        <div className="admin-form-grid">
          <TagsField label="Specializace" value={specializations} onChange={setSpecializations} placeholder="Luxusní nemovitosti, Novostavby..." />
          <TagsField label="Typy nemovitostí" value={propertyTypes} onChange={setPropertyTypes} placeholder="Byty, Domy, Pozemky..." />
          <TagsField label={t.admin.languages} value={languages} onChange={setLanguages} placeholder={t.admin.languagesPlaceholder} />
          <TagsField label={t.admin.certifications} value={certifications} onChange={setCertifications} placeholder={t.admin.certificationsPlaceholder} />
          <TagsField label="Oblast působení (Město, Okres, Země)" value={serviceAreas} onChange={setServiceAreas} placeholder="Praha, Středočeský, CZ" />
          <NumberField label="Cenový rozsah od" value={priceRangeMin} onChange={setPriceRangeMin} placeholder="1000000" />
          <NumberField label="Cenový rozsah do" value={priceRangeMax} onChange={setPriceRangeMax} placeholder="50000000" />
        </div>
      </Section>

      {/* ── Výkon & Statistiky ── */}
      <Section title="Výkon & Statistiky" defaultOpen={false}>
        <div className="admin-form-grid">
          <NumberField label={t.admin.yearStarted} value={yearStarted} onChange={setYearStarted} placeholder="2015" min={1950} />
          <NumberField label="Celkem obchodů" value={totalDeals} onChange={setTotalDeals} placeholder="0" />
          <NumberField label="Objem prodejů (Kč)" value={totalSalesVolume} onChange={setTotalSalesVolume} placeholder="0" />
          <NumberField label="Ø odpověď (hod)" value={avgResponseTimeHours} onChange={setAvgResponseTimeHours} placeholder="2" />
          <NumberField label="Míra odpovědi (%)" value={responseRatePct} onChange={setResponseRatePct} placeholder="95" min={0} />
        </div>
      </Section>

      {/* ── Ocenění ── */}
      <Section title="Ocenění" defaultOpen={false}>
        {awards.map((a, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
            <input
              type="text" value={a.name} placeholder="Název ocenění"
              onChange={(e) => { const copy = [...awards]; copy[i] = { ...copy[i], name: e.target.value }; setAwards(copy); }}
              style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-light)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: "0.85rem" }}
            />
            <input
              type="number" value={a.year || ""} placeholder="Rok"
              onChange={(e) => { const copy = [...awards]; copy[i] = { ...copy[i], year: e.target.value ? Number(e.target.value) : undefined }; setAwards(copy); }}
              style={{ width: 80, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-light)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: "0.85rem" }}
            />
            <button type="button" onClick={() => setAwards(awards.filter((_, j) => j !== i))} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border-light)", background: "var(--bg-filter)", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.8rem" }}>X</button>
          </div>
        ))}
        <button type="button" onClick={() => setAwards([...awards, { name: "" }])} className="admin-btn admin-btn--secondary" style={{ marginTop: 4 }}>
          + Přidat ocenění
        </button>
      </Section>

      {/* ── Galerie ── */}
      <Section title="Galerie fotek" defaultOpen={false}>
        {gallery.map((url, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
            <input
              type="text" value={url} placeholder="URL fotky"
              onChange={(e) => { const copy = [...gallery]; copy[i] = e.target.value; setGallery(copy); }}
              style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-light)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: "0.85rem" }}
            />
            {url && <img src={url} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: "cover" }} />}
            <button type="button" onClick={() => setGallery(gallery.filter((_, j) => j !== i))} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border-light)", background: "var(--bg-filter)", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.8rem" }}>X</button>
          </div>
        ))}
        <button type="button" onClick={() => setGallery([...gallery, ""])} className="admin-btn admin-btn--secondary" style={{ marginTop: 4 }}>
          + Přidat fotku
        </button>
      </Section>

      {/* ── Cover photo ── */}
      <Section title="Cover foto (pozadí profilu)" defaultOpen={false}>
        <SingleImageUpload label="Cover foto" value={coverPhoto} onChange={setCoverPhoto} size={200} />
      </Section>

      {/* ── Save ── */}
      <div className="pf-actions">
        <button className="admin-btn admin-btn--primary" onClick={handleSubmit} disabled={saving}>
          {saving ? <span className="pf-spinner-sm" /> : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
          )}
          {mode === "create" ? t.admin.createBroker : t.admin.saveChanges}
        </button>
      </div>
    </div>
  );
}
