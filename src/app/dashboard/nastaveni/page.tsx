"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/components/auth-provider";
import { getProfile, updateProfile, uploadAvatar, type Profile } from "@/lib/profile";

export default function SettingsPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [preferredCity, setPreferredCity] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    getProfile(user.id).then((p) => {
      if (p) {
        setProfile(p);
        setFullName(p.full_name || "");
        setPhone(p.phone || "");
        setPreferredCity(p.preferred_city || "");
      }
    });
  }, [user]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setSaved(false);

    const updated = await updateProfile(user.id, {
      full_name: fullName || null,
      phone: phone || null,
      preferred_city: preferredCity || null,
    });

    if (updated) setProfile(updated);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("Maximální velikost souboru je 2 MB");
      return;
    }

    setUploading(true);
    const url = await uploadAvatar(user.id, file);
    if (url) {
      await updateProfile(user.id, { avatar_url: url });
      setProfile((prev) => prev ? { ...prev, avatar_url: url } : prev);
    }
    setUploading(false);
  }

  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url;
  const initial = (fullName || user?.email || "?").charAt(0).toUpperCase();

  return (
    <div className="dashboard-page">
      <h1 className="dashboard-page-title">Nastavení profilu</h1>

      <div className="settings-avatar-section">
        <button
          type="button"
          className="settings-avatar"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="" />
          ) : (
            <span className="settings-avatar-initial">{initial}</span>
          )}
          <div className="settings-avatar-overlay">
            {uploading ? "..." : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            )}
          </div>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleAvatarUpload}
          style={{ display: "none" }}
        />
        <span className="settings-avatar-hint">Kliknutím změníte fotku</span>
      </div>

      <form onSubmit={handleSave} className="settings-form">
        <label className="auth-label">
          E-mail
          <input
            type="email"
            value={user?.email || ""}
            className="auth-input"
            disabled
          />
        </label>

        <label className="auth-label">
          Jméno a příjmení
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="auth-input"
          />
        </label>

        <label className="auth-label">
          Telefon
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="auth-input"
            placeholder="+420"
          />
        </label>

        <label className="auth-label">
          Preferované město
          <input
            type="text"
            value={preferredCity}
            onChange={(e) => setPreferredCity(e.target.value)}
            className="auth-input"
            placeholder="např. Praha"
          />
        </label>

        <div className="settings-form-actions">
          <button type="submit" className="auth-submit" disabled={saving}>
            {saving ? "Ukládám..." : "Uložit změny"}
          </button>
          {saved && <span className="settings-saved">Uloženo</span>}
        </div>
      </form>
    </div>
  );
}
