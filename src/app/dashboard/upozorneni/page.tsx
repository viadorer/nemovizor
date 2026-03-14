"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { getProfile, updateProfile, type Profile } from "@/lib/profile";
import { getBrowserSupabase } from "@/lib/supabase-browser";

type SavedSearchNotif = {
  id: string;
  name: string;
  notify_email: boolean;
  notify_frequency: string;
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [searches, setSearches] = useState<SavedSearchNotif[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    getProfile(user.id).then(setProfile);

    const supabase = getBrowserSupabase();
    if (supabase) {
      supabase
        .from("saved_searches")
        .select("id, name, notify_email, notify_frequency")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .then(({ data }) => {
          setSearches((data as SavedSearchNotif[]) ?? []);
          setLoading(false);
        });
    }
  }, [user]);

  async function toggleGlobalEmail() {
    if (!user || !profile) return;
    const updated = await updateProfile(user.id, {
      notification_email: !profile.notification_email,
    });
    if (updated) setProfile(updated);
  }

  async function toggleSearchNotify(id: string, current: boolean) {
    const supabase = getBrowserSupabase();
    if (!supabase || !user) return;
    await supabase.from("saved_searches").update({ notify_email: !current }).eq("id", id);
    setSearches((prev) =>
      prev.map((s) => (s.id === id ? { ...s, notify_email: !current } : s))
    );
  }

  async function changeFrequency(id: string, freq: string) {
    const supabase = getBrowserSupabase();
    if (!supabase || !user) return;
    await supabase.from("saved_searches").update({ notify_frequency: freq }).eq("id", id);
    setSearches((prev) =>
      prev.map((s) => (s.id === id ? { ...s, notify_frequency: freq } : s))
    );
  }

  if (loading) {
    return (
      <div className="dashboard-page">
        <h1 className="dashboard-page-title">Upozorneni</h1>
        <p className="dashboard-loading">Nacitani...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <h1 className="dashboard-page-title">Upozorneni</h1>

      <div className="dashboard-info-banner">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        Emailova upozorneni budou spustena brzy. Zde si muzete predem nastavit preference.
      </div>

      <section className="dashboard-section">
        <h2 className="dashboard-section-title">Globalni nastaveni</h2>

        <div className="dashboard-toggle-row">
          <div className="dashboard-toggle-info">
            <span>Emailova upozorneni</span>
            <span className="dashboard-toggle-desc">Zasilat e-maily o novych nabidkach</span>
          </div>
          <button
            type="button"
            className={`dashboard-toggle ${profile?.notification_email ? "dashboard-toggle--on" : ""}`}
            onClick={toggleGlobalEmail}
          >
            <span className="dashboard-toggle-knob" />
          </button>
        </div>

        <div className="dashboard-toggle-row">
          <div className="dashboard-toggle-info">
            <span>Push notifikace</span>
            <span className="dashboard-toggle-desc">Brzy</span>
          </div>
          <button type="button" className="dashboard-toggle" disabled>
            <span className="dashboard-toggle-knob" />
          </button>
        </div>
      </section>

      {searches.length > 0 && (
        <section className="dashboard-section">
          <h2 className="dashboard-section-title">Upozorneni na ulozena hledani</h2>

          {searches.map((s) => (
            <div key={s.id} className="dashboard-toggle-row">
              <div className="dashboard-toggle-info">
                <span>{s.name}</span>
                {s.notify_email && (
                  <select
                    className="dashboard-freq-select"
                    value={s.notify_frequency}
                    onChange={(e) => changeFrequency(s.id, e.target.value)}
                  >
                    <option value="instant">Okamzite</option>
                    <option value="daily">Denne</option>
                    <option value="weekly">Tydne</option>
                  </select>
                )}
              </div>
              <button
                type="button"
                className={`dashboard-toggle ${s.notify_email ? "dashboard-toggle--on" : ""}`}
                onClick={() => toggleSearchNotify(s.id, s.notify_email)}
              >
                <span className="dashboard-toggle-knob" />
              </button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
