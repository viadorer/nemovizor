"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  TextField,
  TextareaField,
  NumberField,
  TagsField,
  SelectField,
  CheckboxField,
} from "@/components/admin/form-fields";
import { SingleImageUpload } from "@/components/admin/single-image-upload";
import { AddressAutocomplete, type MapySuggestion } from "@/components/admin/address-autocomplete";
import { useT } from "@/i18n/provider";

type AgencyFormProps = {
  mode: "create" | "edit";
  agencyId?: string;
  redirectTo?: string;
};

function slugify(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
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

export function AgencyForm({ mode, agencyId, redirectTo }: AgencyFormProps) {
  const router = useRouter();
  const t = useT();

  // ── Basic ──
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [seatCity, setSeatCity] = useState("");
  const [seatAddress, setSeatAddress] = useState("");
  const [description, setDescription] = useState("");
  const [logo, setLogo] = useState("");
  const [foundedYear, setFoundedYear] = useState<number | null>(null);
  const [specList, setSpecList] = useState<string[]>([]);
  const [parentAgencyId, setParentAgencyId] = useState("");
  const [isIndependent, setIsIndependent] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [totalBrokers, setTotalBrokers] = useState<number | null>(null);
  const [totalListings, setTotalListings] = useState<number | null>(null);
  const [totalDeals, setTotalDeals] = useState<number | null>(null);
  const [userId, setUserId] = useState("");

  // ── Extended ──
  const [motto, setMotto] = useState("");
  const [descriptionLong, setDescriptionLong] = useState("");
  const [mission, setMission] = useState("");
  const [valuesText, setValuesText] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoType, setVideoType] = useState("youtube");
  const [coverPhoto, setCoverPhoto] = useState("");
  const [gallery, setGallery] = useState<string[]>([]);
  const [awards, setAwards] = useState<{ name: string; year?: number }[]>([]);
  const [agencyCertifications, setAgencyCertifications] = useState<string[]>([]);

  // ── Social ──
  const [linkedin, setLinkedin] = useState("");
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [twitter, setTwitter] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [calendlyUrl, setCalendlyUrl] = useState("");

  // ── Service ──
  const [serviceAreas, setServiceAreas] = useState<string[]>([]);
  const [serviceCountries, setServiceCountries] = useState<string[]>([]);

  // ── Performance ──
  const [totalSalesVolume, setTotalSalesVolume] = useState<number | null>(null);
  const [avgResponseTimeHours, setAvgResponseTimeHours] = useState<number | null>(null);
  const [propertiesSoldCount, setPropertiesSoldCount] = useState<number | null>(null);

  // ── CTA ──
  const [newsletterEnabled, setNewsletterEnabled] = useState(false);
  const [ctaText, setCtaText] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");

  // ── UI ──
  const [parentAgencies, setParentAgencies] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [slugManual, setSlugManual] = useState(false);

  useEffect(() => {
    if (!slugManual) setSlug(slugify(name));
  }, [name, slugManual]);

  useEffect(() => {
    fetch("/api/admin/agencies?limit=1000").then((r) => r.json()).then((res) => {
      if (res.data && Array.isArray(res.data)) {
        const map: Record<string, string> = {};
        for (const a of res.data) { if (a.id !== agencyId) map[a.id] = a.name + (a.seat_city ? ` (${a.seat_city})` : ""); }
        setParentAgencies(map);
      }
    }).catch(() => {});
  }, [agencyId]);

  useEffect(() => {
    if (mode === "edit" && agencyId) {
      setLoading(true);
      fetch(`/api/admin/agencies?id=${agencyId}`).then((r) => r.json()).then((res) => {
        if (res.data) {
          const d = res.data;
          setName(d.name ?? ""); setSlug(d.slug ?? ""); setEmail(d.email ?? "");
          setPhone(d.phone ?? ""); setWebsiteUrl(d.website ?? "");
          setSeatCity(d.seat_city ?? ""); setSeatAddress(d.seat_address ?? "");
          setDescription(d.description ?? ""); setLogo(d.logo ?? "");
          setFoundedYear(d.founded_year ?? null); setSpecList(d.specializations ?? []);
          setParentAgencyId(d.parent_agency_id ?? ""); setIsIndependent(d.is_independent ?? false);
          setRating(d.rating ?? null); setTotalBrokers(d.total_brokers ?? null);
          setTotalListings(d.total_listings ?? null); setTotalDeals(d.total_deals ?? null);
          setUserId(d.user_id ?? "");
          // Extended
          setMotto(d.motto ?? ""); setDescriptionLong(d.description_long ?? "");
          setMission(d.mission ?? ""); setValuesText(d.values_text ?? "");
          setVideoUrl(d.video_url ?? ""); setVideoType(d.video_type ?? "youtube");
          setCoverPhoto(d.cover_photo ?? ""); setGallery(d.gallery ?? []);
          setAwards(d.awards ?? []); setAgencyCertifications(d.certifications ?? []);
          // Social
          setLinkedin(d.linkedin ?? ""); setInstagram(d.instagram ?? "");
          setFacebook(d.facebook ?? ""); setTwitter(d.twitter ?? "");
          setWhatsapp(d.whatsapp ?? ""); setCalendlyUrl(d.calendly_url ?? "");
          // Service
          setServiceAreas((d.service_areas || []).map((sa: { city: string; district?: string; country?: string }) =>
            [sa.district, sa.city, sa.country?.toUpperCase()].filter(Boolean).join(", ")
          ));
          setServiceCountries(d.service_countries ?? []);
          // Performance
          setTotalSalesVolume(d.total_sales_volume ?? null);
          setAvgResponseTimeHours(d.avg_response_time_hours ?? null);
          setPropertiesSoldCount(d.properties_sold_count ?? null);
          // CTA
          setNewsletterEnabled(d.newsletter_enabled ?? false);
          setCtaText(d.cta_text ?? ""); setCtaUrl(d.cta_url ?? "");
          setSlugManual(true);
        }
      }).catch(() => setError(t.admin.loadError)).finally(() => setLoading(false));
    }
  }, [mode, agencyId, t]);

  async function handleSubmit() {
    if (!name.trim()) { setError(t.admin.nameRequired); return; }
    if (!slug.trim()) { setError(t.admin.slugRequired); return; }
    setSaving(true); setError(null);

    try {
      const payload: Record<string, unknown> = {
        name: name.trim(), slug: slug.trim(),
        email: email.trim() || "", phone: phone.trim() || "",
        website: websiteUrl.trim() || null, seat_city: seatCity.trim() || null,
        seat_address: seatAddress.trim() || null, description: description.trim() || "",
        logo: logo.trim() || null, founded_year: foundedYear || null,
        specializations: specList.length > 0 ? specList : [],
        parent_agency_id: parentAgencyId || null, is_independent: isIndependent,
        rating: rating ?? 0, total_brokers: totalBrokers ?? 0,
        total_listings: totalListings ?? 0, total_deals: totalDeals ?? 0,
        user_id: userId.trim() || null,
        // Extended
        motto: motto.trim() || null, description_long: descriptionLong.trim() || null,
        mission: mission.trim() || null, values_text: valuesText.trim() || null,
        video_url: videoUrl.trim() || null, video_type: videoType || "youtube",
        cover_photo: coverPhoto.trim() || null,
        gallery: gallery.length > 0 ? gallery : null,
        awards: awards.length > 0 ? awards : null,
        certifications: agencyCertifications.length > 0 ? agencyCertifications : null,
        // Social
        linkedin: linkedin.trim() || null, instagram: instagram.trim() || null,
        facebook: facebook.trim() || null, twitter: twitter.trim() || null,
        whatsapp: whatsapp.trim() || null, calendly_url: calendlyUrl.trim() || null,
        // Service
        service_areas: serviceAreas.length > 0
          ? serviceAreas.map((s) => { const parts = s.split(",").map((p) => p.trim()); return { city: parts[0] || "", district: parts[1] || "", country: parts[2]?.toLowerCase() || "" }; })
          : null,
        service_countries: serviceCountries.length > 0 ? serviceCountries : null,
        // Performance
        total_sales_volume: totalSalesVolume, avg_response_time_hours: avgResponseTimeHours,
        properties_sold_count: propertiesSoldCount,
        // CTA
        newsletter_enabled: newsletterEnabled,
        cta_text: ctaText.trim() || null, cta_url: ctaUrl.trim() || null,
      };
      if (mode === "edit") payload.id = agencyId;

      const res = await fetch("/api/admin/agencies", {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const data = await res.json().catch(() => null); throw new Error(data?.error || t.admin.saveError); }
      setSuccess(true);
      setTimeout(() => router.push(redirectTo || "/dashboard/sprava/kancelare"), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.admin.saveError);
    } finally { setSaving(false); }
  }

  if (loading) return <div className="pf-loading"><div className="pf-spinner" /><span>{t.admin.loading}</span></div>;

  return (
    <div className="pf-main">
      {error && (
        <div className="pf-error">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="pf-success">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg>
          <span>{t.admin.saved}</span>
        </div>
      )}

      {/* ── Základní údaje ── */}
      <Section title="Základní údaje">
        <div className="admin-form-grid">
          <TextField label={t.admin.agencyName} value={name} onChange={setName} placeholder={t.admin.agencyNamePlaceholder} required />
          <TextField label={t.admin.slug} value={slug} onChange={(v) => { setSlugManual(true); setSlug(v); }} placeholder="url-slug" required />
          <TextField label={t.admin.email} value={email} onChange={setEmail} placeholder="info@agency.com" type="email" />
          <TextField label={t.admin.phone} value={phone} onChange={setPhone} placeholder="+420 123 456 789" />
          <TextField label={t.admin.website} value={websiteUrl} onChange={setWebsiteUrl} placeholder="https://www.example.com" />
          <TextField label="WhatsApp" value={whatsapp} onChange={setWhatsapp} placeholder="+420123456789" />
          <TextField label="User ID (vlastník)" value={userId} onChange={setUserId} placeholder="UUID přihlášeného uživatele" />
        </div>

        <AddressAutocomplete
          onSelect={(s: MapySuggestion) => {
            const city = s.regionalStructure?.find((r) => r.type === "regional.municipality")?.name;
            if (city) setSeatCity(city);
            setSeatAddress(s.name + (s.location ? `, ${s.location}` : ""));
          }}
          isLand={false}
        />

        <div className="admin-form-grid">
          <TextField label={t.admin.seatCity} value={seatCity} onChange={setSeatCity} placeholder="Praha" />
          <TextField label={t.admin.seatAddress} value={seatAddress} onChange={setSeatAddress} placeholder="Ulice 123, 110 00 Praha" />
        </div>

        <SingleImageUpload label={t.admin.logo} value={logo} onChange={setLogo} shape="square" size={80} />
      </Section>

      {/* ── Profil & Popis ── */}
      <Section title="Profil & Popis" defaultOpen={mode === "edit"}>
        <div className="admin-form-grid">
          <TextField label="Motto / Slogan" value={motto} onChange={setMotto} placeholder="Váš profesionální slogan..." />
          <NumberField label={t.admin.foundedYear} value={foundedYear} onChange={setFoundedYear} min={1900} />
        </div>
        <TextareaField label={t.admin.description} value={description} onChange={setDescription} placeholder={t.admin.descriptionPlaceholder} rows={3} />
        <TextareaField label="Podrobný popis" value={descriptionLong} onChange={setDescriptionLong} placeholder="Historie, přístup, co vás odlišuje od konkurence..." rows={6} />
        <TextareaField label="Mise" value={mission} onChange={setMission} placeholder="Naše mise..." rows={3} />
        <TextareaField label="Hodnoty" value={valuesText} onChange={setValuesText} placeholder="Na čem stavíme..." rows={3} />
        <TagsField label={t.admin.specializations} value={specList} onChange={setSpecList} placeholder={t.admin.specializationPlaceholder} />
        <div className="admin-form-grid">
          <SelectField label={t.admin.parentAgency} value={parentAgencyId} onChange={setParentAgencyId} options={parentAgencies} placeholder={t.admin.parentAgencyNone} />
          <CheckboxField label={t.admin.independentAgency} checked={isIndependent} onChange={setIsIndependent} />
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
          <TextField label="LinkedIn" value={linkedin} onChange={setLinkedin} placeholder="https://linkedin.com/company/..." />
          <TextField label="Instagram" value={instagram} onChange={setInstagram} placeholder="https://instagram.com/..." />
          <TextField label="Facebook" value={facebook} onChange={setFacebook} placeholder="https://facebook.com/..." />
          <TextField label="X (Twitter)" value={twitter} onChange={setTwitter} placeholder="https://x.com/..." />
          <TextField label="Calendly (rezervace)" value={calendlyUrl} onChange={setCalendlyUrl} placeholder="https://calendly.com/..." />
        </div>
      </Section>

      {/* ── Oblast působení ── */}
      <Section title="Oblast působení" defaultOpen={false}>
        <div className="admin-form-grid">
          <TagsField label="Země" value={serviceCountries} onChange={setServiceCountries} placeholder="CZ, SK, DE, AT..." />
          <TagsField label="Oblasti (Město, Okres, Země)" value={serviceAreas} onChange={setServiceAreas} placeholder="Praha, Středočeský, CZ" />
        </div>
      </Section>

      {/* ── Výkon ── */}
      <Section title="Výkon & Statistiky" defaultOpen={false}>
        <div className="admin-form-grid">
          <NumberField label="Celkem obchodů" value={totalDeals} onChange={setTotalDeals} placeholder="0" />
          <NumberField label="Objem prodejů (Kč)" value={totalSalesVolume} onChange={setTotalSalesVolume} placeholder="0" />
          <NumberField label="Prodané nemovitosti" value={propertiesSoldCount} onChange={setPropertiesSoldCount} placeholder="0" />
          <NumberField label="Ø odpověď (hod)" value={avgResponseTimeHours} onChange={setAvgResponseTimeHours} placeholder="2" />
        </div>
      </Section>

      {/* ── Ocenění & Certifikace ── */}
      <Section title="Ocenění & Certifikace" defaultOpen={false}>
        <TagsField label="Certifikace" value={agencyCertifications} onChange={setAgencyCertifications} placeholder="ISO 9001, ARK..." />
        {awards.map((a, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
            <input type="text" value={a.name} placeholder="Název ocenění"
              onChange={(e) => { const copy = [...awards]; copy[i] = { ...copy[i], name: e.target.value }; setAwards(copy); }}
              style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-light)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: "0.85rem" }}
            />
            <input type="number" value={a.year || ""} placeholder="Rok"
              onChange={(e) => { const copy = [...awards]; copy[i] = { ...copy[i], year: e.target.value ? Number(e.target.value) : undefined }; setAwards(copy); }}
              style={{ width: 80, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-light)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: "0.85rem" }}
            />
            <button type="button" onClick={() => setAwards(awards.filter((_, j) => j !== i))} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border-light)", background: "var(--bg-filter)", color: "var(--text-muted)", cursor: "pointer" }}>X</button>
          </div>
        ))}
        <button type="button" onClick={() => setAwards([...awards, { name: "" }])} className="admin-btn admin-btn--secondary" style={{ marginTop: 4 }}>+ Přidat ocenění</button>
      </Section>

      {/* ── Galerie ── */}
      <Section title="Galerie fotek" defaultOpen={false}>
        {gallery.map((url, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
            <input type="text" value={url} placeholder="URL fotky"
              onChange={(e) => { const copy = [...gallery]; copy[i] = e.target.value; setGallery(copy); }}
              style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-light)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: "0.85rem" }}
            />
            {url && <img src={url} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: "cover" }} />}
            <button type="button" onClick={() => setGallery(gallery.filter((_, j) => j !== i))} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border-light)", background: "var(--bg-filter)", color: "var(--text-muted)", cursor: "pointer" }}>X</button>
          </div>
        ))}
        <button type="button" onClick={() => setGallery([...gallery, ""])} className="admin-btn admin-btn--secondary" style={{ marginTop: 4 }}>+ Přidat fotku</button>
      </Section>

      {/* ── Cover foto ── */}
      <Section title="Cover foto" defaultOpen={false}>
        <SingleImageUpload label="Cover foto (pozadí profilu)" value={coverPhoto} onChange={setCoverPhoto} size={200} />
      </Section>

      {/* ── CTA & Newsletter ── */}
      <Section title="CTA & Newsletter" defaultOpen={false}>
        <div className="admin-form-grid">
          <TextField label="CTA text" value={ctaText} onChange={setCtaText} placeholder="Kontaktujte nás pro nezávaznou konzultaci" />
          <TextField label="CTA URL" value={ctaUrl} onChange={setCtaUrl} placeholder="https://..." />
          <CheckboxField label="Povolit newsletter přihlášení" checked={newsletterEnabled} onChange={setNewsletterEnabled} />
        </div>
      </Section>

      {/* ── Save ── */}
      <div className="pf-actions">
        <button type="button" className="admin-btn admin-btn--primary" disabled={saving || success} onClick={handleSubmit}>
          {saving ? t.admin.saving : mode === "create" ? t.admin.createAgency : t.admin.saveChanges}
        </button>
      </div>
    </div>
  );
}
