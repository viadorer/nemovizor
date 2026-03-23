"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { useT } from "@/i18n/provider";
import { formatPrice } from "@/lib/api";

type ViewedItem = {
  id: string;
  viewed_at: string;
  properties: {
    id: string;
    slug: string;
    title: string;
    price: number;
    price_currency: string;
    area: number;
    rooms_label: string | null;
    city: string;
    location_label: string | null;
    image_src: string | null;
    image_alt: string | null;
    listing_type: string;
    category: string;
  };
};

export default function RecentlyViewedPage() {
  const { user } = useAuth();
  const t = useT();
  const [items, setItems] = useState<ViewedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const supabase = getBrowserSupabase();
    if (!supabase) return;

    supabase
      .from("recently_viewed")
      .select("id, viewed_at, properties(id, slug, title, price, price_currency, area, rooms_label, city, location_label, image_src, image_alt, listing_type, category)")
      .eq("user_id", user.id)
      .order("viewed_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setItems((data as unknown as ViewedItem[]) ?? []);
        setLoading(false);
      });
  }, [user]);

  async function handleClear() {
    const supabase = getBrowserSupabase();
    if (!supabase || !user) return;
    await supabase.from("recently_viewed").delete().eq("user_id", user.id);
    setItems([]);
  }

  async function handleRemove(id: string) {
    const supabase = getBrowserSupabase();
    if (!supabase || !user) return;
    await supabase.from("recently_viewed").delete().eq("id", id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  if (loading) {
    return (
      <div className="dashboard-page">
        <h1 className="dashboard-page-title">{t.dashboard.recentlyViewedTitle}</h1>
        <p className="dashboard-loading">{t.common.loading}</p>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-page-header">
        <h1 className="dashboard-page-title">{t.dashboard.recentlyViewedTitle}</h1>
        {items.length > 0 && (
          <button type="button" className="dashboard-clear-btn" onClick={handleClear}>
            {t.dashboard.clearAll}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="dashboard-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <p>{t.dashboard.recentlyViewedEmpty}</p>
          <Link href="/nabidky" className="dashboard-action-btn">{t.dashboard.searchProperties}</Link>
        </div>
      ) : (
        <div className="dashboard-favorites-grid">
          {items.map((item) => {
            const p = item.properties;
            if (!p) return null;
            const price = formatPrice(p.price, p.price_currency);
            return (
              <div key={item.id} className="dashboard-favorite-card">
                <Link href={`/nemovitost/${p.slug}`} className="dashboard-favorite-img-wrap">
                  {p.image_src ? (
                    <img src={p.image_src} alt={p.image_alt ?? p.title} className="dashboard-favorite-img" loading="lazy" />
                  ) : (
                    <div className="dashboard-favorite-img-placeholder" />
                  )}
                </Link>
                <div className="dashboard-favorite-info">
                  <Link href={`/nemovitost/${p.slug}`} className="dashboard-favorite-title">{p.title}</Link>
                  <span className="dashboard-favorite-location">{p.location_label ?? p.city}</span>
                  <span className="dashboard-favorite-price">{price}</span>
                  <span className="dashboard-favorite-meta">
                    {new Date(item.viewed_at).toLocaleString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <button
                  type="button"
                  className="dashboard-favorite-remove"
                  onClick={() => handleRemove(item.id)}
                  title={t.common.delete}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
