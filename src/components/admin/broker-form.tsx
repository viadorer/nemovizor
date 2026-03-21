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

export function BrokerForm({ mode, brokerId, redirectTo }: BrokerFormProps) {
  const router = useRouter();
  const t = useT();

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

  const [agencies, setAgencies] = useState<Record<string, string>>({});
  const [branches, setBranches] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [slugManual, setSlugManual] = useState(false);

  // Auto-generate slug from name
  useEffect(() => {
    if (!slugManual) {
      setSlug(slugify(name));
    }
  }, [name, slugManual]);

  // Fetch agencies list
  useEffect(() => {
    fetch("/api/admin/agencies?limit=1000")
      .then((r) => r.json())
      .then((res) => {
        if (res.data && Array.isArray(res.data)) {
          const map: Record<string, string> = {};
          for (const a of res.data) {
            map[a.id] = a.name;
          }
          setAgencies(map);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch branches for selected agency
  useEffect(() => {
    if (!agencyId) {
      setBranches({});
      setBranchId("");
      return;
    }
    fetch(`/api/admin/branches?agency_id=${agencyId}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.data && Array.isArray(res.data)) {
          const map: Record<string, string> = {};
          for (const b of res.data) {
            map[b.id] = b.name + (b.city ? ` (${b.city})` : "") + (b.is_headquarters ? ` - ${t.admin.headquartersSuffix}` : "");
          }
          setBranches(map);
        }
      })
      .catch(() => {});
  }, [agencyId, t]);

  // Fetch broker data in edit mode
  useEffect(() => {
    if (mode === "edit" && brokerId) {
      setLoading(true);
      fetch(`/api/admin/brokers?id=${brokerId}`)
        .then((r) => r.json())
        .then((res) => {
          if (res.data) {
            const d = res.data;
            setName(d.name || "");
            setSlug(d.slug || "");
            setEmail(d.email || "");
            setPhone(d.phone || "");
            setAgencyId(d.agency_id || "");
            setPhoto(d.photo || "");
            setBio(d.bio || "");
            setSpecialization(d.specialization || "");
            setLanguages(d.languages || []);
            setCertifications(d.certifications || []);
            setYearStarted(d.year_started ?? null);
            setRating(d.rating ?? null);
            setActiveListings(d.active_listings ?? null);
            setTotalDeals(d.total_deals ?? null);
            setUserId(d.user_id || "");
            setBranchId(d.branch_id || "");
            setSlugManual(true);
          }
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : t.admin.loadError);
        })
        .finally(() => setLoading(false));
    }
  }, [mode, brokerId, t]);

  async function handleSubmit() {
    if (!name.trim()) {
      setError(t.admin.nameRequired);
      return;
    }
    if (!slug.trim()) {
      setError(t.admin.slugRequired);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // NOT NULL DEFAULT '' columns must receive empty string, not null
      const payload: Record<string, unknown> = {
        name: name.trim(),
        slug: slug.trim(),
        email: email.trim() || "",
        phone: phone.trim() || "",
        agency_id: agencyId || null,
        photo: photo.trim() || null,
        bio: bio.trim() || "",
        specialization: specialization.trim() || "",
        agency_name: "", // default
        languages: languages.length > 0 ? languages : null,
        certifications: certifications.length > 0 ? certifications : null,
        year_started: yearStarted,
        rating: rating ?? 0,
        active_listings: activeListings ?? 0,
        total_deals: totalDeals ?? 0,
        user_id: userId.trim() || null,
        branch_id: branchId || null,
      };

      if (mode === "edit") {
        payload.id = brokerId;
      }

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
      setTimeout(() => {
        router.push(redirectTo || "/dashboard/sprava/makleri");
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
        <h3>{mode === "create" ? t.admin.brokerCreated : t.admin.brokerSaved}</h3>
        <p>{t.admin.redirecting}</p>
      </div>
    );
  }

  return (
    <div className="pf-main">
      {/* Header */}
      <div className="pf-header">
        <button
          className="admin-btn admin-btn--secondary"
          onClick={() => router.push(redirectTo || "/dashboard/sprava/makleri")}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          {t.admin.back}
        </button>
        <h2>{mode === "create" ? t.admin.newBroker : t.admin.editBroker}</h2>
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

      {/* Form */}
      <div className="admin-form-grid">
        <TextField
          label={t.admin.brokerName}
          value={name}
          onChange={(v) => setName(v)}
          placeholder={t.admin.brokerNamePlaceholder}
          required
        />
        <TextField
          label={t.admin.slug}
          value={slug}
          onChange={(v) => {
            setSlug(v);
            setSlugManual(true);
          }}
          placeholder="jan-novak"
          required
        />

        <TextField
          label={t.admin.email}
          value={email}
          onChange={setEmail}
          placeholder="jan@example.com"
          type="email"
        />
        <TextField
          label={t.admin.phone}
          value={phone}
          onChange={setPhone}
          placeholder="+420 123 456 789"
        />

        <SelectField
          label={t.admin.agency}
          value={agencyId}
          onChange={(v) => {
            setAgencyId(v);
            setBranchId("");
          }}
          options={agencies}
          placeholder={t.admin.agencyPlaceholder}
        />
        {agencyId && Object.keys(branches).length > 0 && (
          <SelectField
            label={t.admin.branch}
            value={branchId}
            onChange={setBranchId}
            options={branches}
            placeholder={t.admin.branchPlaceholder}
          />
        )}
      </div>

      <SingleImageUpload
        label={t.admin.profilePhoto}
        value={photo}
        onChange={setPhoto}
        shape="round"
        size={96}
      />

      <div className="admin-form-grid">
        <div className="admin-form-full">
          <TextareaField
            label={t.admin.bio}
            value={bio}
            onChange={setBio}
            placeholder={t.admin.bioPlaceholder}
            rows={4}
          />
        </div>

        <TextField
          label={t.admin.specialization}
          value={specialization}
          onChange={setSpecialization}
          placeholder={t.admin.specializationPlaceholder2}
        />
        <NumberField
          label={t.admin.yearStarted}
          value={yearStarted}
          onChange={setYearStarted}
          placeholder="2015"
          min={1950}
        />

        <TagsField
          label={t.admin.languages}
          value={languages}
          onChange={setLanguages}
          placeholder={t.admin.languagesPlaceholder}
        />
        <TagsField
          label={t.admin.certifications}
          value={certifications}
          onChange={setCertifications}
          placeholder={t.admin.certificationsPlaceholder}
        />

      </div>

      {/* Save button */}
      <div className="pf-actions">
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
          {mode === "create" ? t.admin.createBroker : t.admin.saveChanges}
        </button>
      </div>
    </div>
  );
}
