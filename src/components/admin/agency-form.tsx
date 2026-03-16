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

type AgencyFormProps = {
  mode: "create" | "edit";
  agencyId?: string;
  redirectTo?: string;
};

type AgencyFormData = {
  name: string;
  slug: string;
  email: string;
  phone: string;
  website: string;
  seat_city: string;
  seat_address: string;
  description: string;
  logo: string;
  founded_year: number | null;
  specializations: string[];
  parent_agency_id: string;
  is_independent: boolean;
  rating: number | null;
  total_brokers: number | null;
  total_listings: number | null;
  total_deals: number | null;
  user_id: string;
};

const EMPTY_FORM: AgencyFormData = {
  name: "",
  slug: "",
  email: "",
  phone: "",
  website: "",
  seat_city: "",
  seat_address: "",
  description: "",
  logo: "",
  founded_year: null,
  specializations: [],
  parent_agency_id: "",
  is_independent: false,
  rating: null,
  total_brokers: null,
  total_listings: null,
  total_deals: null,
  user_id: "",
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export function AgencyForm({ mode, agencyId, redirectTo }: AgencyFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<AgencyFormData>({ ...EMPTY_FORM });
  const [slugManual, setSlugManual] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [parentAgencies, setParentAgencies] = useState<Record<string, string>>({});

  // Load parent agencies list
  useEffect(() => {
    fetch("/api/admin/agencies?limit=1000")
      .then((r) => r.json())
      .then((res) => {
        if (res.data && Array.isArray(res.data)) {
          const map: Record<string, string> = {};
          for (const a of res.data) {
            // Don't show self in parent list
            if (a.id !== agencyId) {
              map[a.id] = a.name + (a.seat_city ? ` (${a.seat_city})` : "");
            }
          }
          setParentAgencies(map);
        }
      })
      .catch(() => {});
  }, [agencyId]);

  // Load agency data for edit mode
  useEffect(() => {
    if (mode === "edit" && agencyId) {
      setLoading(true);
      fetch(`/api/admin/agencies?id=${agencyId}`)
        .then((r) => r.json())
        .then((res) => {
          if (res.data) {
            const d = res.data;
            setForm({
              name: d.name ?? "",
              slug: d.slug ?? "",
              email: d.email ?? "",
              phone: d.phone ?? "",
              website: d.website ?? "",
              seat_city: d.seat_city ?? "",
              seat_address: d.seat_address ?? "",
              description: d.description ?? "",
              logo: d.logo ?? "",
              founded_year: d.founded_year ?? null,
              specializations: d.specializations ?? [],
              parent_agency_id: d.parent_agency_id ?? "",
              is_independent: d.is_independent ?? false,
              rating: d.rating ?? null,
              total_brokers: d.total_brokers ?? null,
              total_listings: d.total_listings ?? null,
              total_deals: d.total_deals ?? null,
              user_id: d.user_id ?? "",
            });
            setSlugManual(true);
          } else {
            setError("Kancelář nebyla nalezena");
          }
        })
        .catch(() => setError("Chyba při načítání dat"))
        .finally(() => setLoading(false));
    }
  }, [mode, agencyId]);

  function updateField<K extends keyof AgencyFormData>(key: K, value: AgencyFormData[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      // Auto-generate slug from name unless user manually edited slug
      if (key === "name" && !slugManual) {
        next.slug = slugify(value as string);
      }
      return next;
    });
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      setError("Název je povinný");
      return;
    }
    if (!form.slug.trim()) {
      setError("Slug je povinný");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // NOT NULL DEFAULT '' columns must receive empty string, not null
      const payload: Record<string, unknown> = {
        ...form,
        email: form.email || "",
        phone: form.phone || "",
        description: form.description || "",
        total_brokers: form.total_brokers ?? 0,
        total_listings: form.total_listings ?? 0,
        total_deals: form.total_deals ?? 0,
        rating: form.rating ?? 0,
        user_id: form.user_id || null,
        website: form.website || null,
        seat_city: form.seat_city || null,
        seat_address: form.seat_address || null,
        logo: form.logo || null,
        founded_year: form.founded_year || null,
        parent_agency_id: form.parent_agency_id || null,
        is_independent: form.is_independent,
      };

      if (mode === "edit") {
        payload.id = agencyId;
      }

      const res = await fetch("/api/admin/agencies", {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Chyba při ukládání");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push(redirectTo || "/dashboard/sprava/kancelare");
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba při ukládání");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="pf-loading">
        <div className="pf-spinner" />
        <span>Načítání...</span>
      </div>
    );
  }

  return (
    <div className="admin-form">
      {error && (
        <div className="pf-error">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="pf-success">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          <span>Uloženo. Přesměrování...</span>
        </div>
      )}

      <div className="admin-form-grid">
        <TextField
          label="Název"
          value={form.name}
          onChange={(v) => updateField("name", v)}
          placeholder="Název kanceláře"
          required
        />
        <TextField
          label="Slug"
          value={form.slug}
          onChange={(v) => {
            setSlugManual(true);
            updateField("slug", v);
          }}
          placeholder="url-slug"
          required
        />

        <TextField
          label="E-mail"
          value={form.email}
          onChange={(v) => updateField("email", v)}
          placeholder="info@kancelar.cz"
          type="email"
        />
        <TextField
          label="Telefon"
          value={form.phone}
          onChange={(v) => updateField("phone", v)}
          placeholder="+420 123 456 789"
        />
        <TextField
          label="Web"
          value={form.website}
          onChange={(v) => updateField("website", v)}
          placeholder="https://www.kancelar.cz"
        />

      </div>

      <AddressAutocomplete
        onSelect={(s: MapySuggestion) => {
          // Extract city from regional structure
          const city = s.regionalStructure?.find((r) => r.type === "regional.municipality")?.name;
          if (city) updateField("seat_city", city);
          // Build address from name + location
          const addr = s.name + (s.location ? `, ${s.location}` : "");
          updateField("seat_address", addr);
        }}
        isLand={false}
      />

      <div className="admin-form-grid">
        <TextField
          label="Mesto sidla"
          value={form.seat_city}
          onChange={(v) => updateField("seat_city", v)}
          placeholder="Praha"
        />
        <TextField
          label="Adresa sidla"
          value={form.seat_address}
          onChange={(v) => updateField("seat_address", v)}
          placeholder="Ulice 123, 110 00 Praha"
        />
      </div>

      <TextareaField
        label="Popis"
        value={form.description}
        onChange={(v) => updateField("description", v)}
        placeholder="Popis kanceláře..."
        rows={4}
      />

      <SingleImageUpload
        label="Logo kancelare"
        value={form.logo}
        onChange={(v) => updateField("logo", v)}
        shape="square"
        size={80}
      />

      <div className="admin-form-grid">
        <NumberField
          label="Rok založení"
          value={form.founded_year}
          onChange={(v) => updateField("founded_year", v)}
          step="1"
          min={1900}
        />
      </div>

      <TagsField
        label="Specializace"
        value={form.specializations}
        onChange={(v) => updateField("specializations", v)}
        placeholder="Přidat specializaci..."
      />

      <div className="admin-form-grid">
        <SelectField
          label="Materska kancelar"
          value={form.parent_agency_id}
          onChange={(v) => updateField("parent_agency_id", v)}
          options={parentAgencies}
          placeholder="-- Zadna (samostatna) --"
        />
        <CheckboxField
          label="Nezavisla kancelar"
          checked={form.is_independent}
          onChange={(v) => updateField("is_independent", v)}
        />
      </div>

      <div className="pf-actions">
        <button
          type="button"
          className="admin-btn admin-btn--primary"
          disabled={saving || success}
          onClick={handleSubmit}
        >
          {saving ? (
            <>
              <svg className="pf-btn-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
              Ukládám...
            </>
          ) : mode === "create" ? (
            "Vytvořit kancelář"
          ) : (
            "Uložit změny"
          )}
        </button>
      </div>
    </div>
  );
}
