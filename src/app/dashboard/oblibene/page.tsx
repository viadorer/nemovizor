"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { getFavorites, removeFavorite } from "@/lib/favorites";
import Link from "next/link";

type FavoriteItem = {
  id: string;
  property_id: string;
  created_at: string;
  properties: {
    id: string;
    slug: string;
    title: string;
    price: number;
    area: number;
    rooms_label: string;
    city: string;
    location_label: string;
    image_src: string;
    image_alt: string;
    listing_type: string;
    category: string;
  };
};

export default function FavoritesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getFavorites(user.id).then((data) => {
      setItems(data as FavoriteItem[]);
      setLoading(false);
    });
  }, [user]);

  async function handleRemove(propertyId: string) {
    if (!user) return;
    await removeFavorite(user.id, propertyId);
    setItems((prev) => prev.filter((i) => i.property_id !== propertyId));
  }

  function formatPrice(price: number, currency?: string): string {
    const cur = (currency ?? "czk").toUpperCase();
    const localeMap: Record<string, string> = { CZK: "cs-CZ", EUR: "de-DE", GBP: "en-GB", USD: "en-US" };
    const locale = localeMap[cur] ?? "cs-CZ";
    return new Intl.NumberFormat(locale, { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(price);
  }

  if (loading) {
    return (
      <div className="dashboard-page">
        <h1 className="dashboard-page-title">Oblíbené nemovitosti</h1>
        <p className="dashboard-loading">Načítání...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <h1 className="dashboard-page-title">Oblíbené nemovitosti</h1>

      {items.length === 0 ? (
        <div className="dashboard-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          <p>Zatím nemáte žádné oblíbené nemovitosti</p>
          <Link href="/nabidky" className="dashboard-action-btn">Prohlížet nabídky</Link>
        </div>
      ) : (
        <div className="dashboard-favorites-grid">
          {items.map((item) => (
            <div key={item.id} className="dashboard-fav-card">
              <Link href={`/nemovitost/${item.properties.slug}`} className="dashboard-fav-image">
                <img src={item.properties.image_src} alt={item.properties.image_alt} />
                <span className={`property-badge property-badge--${item.properties.listing_type}`}>
                  {item.properties.listing_type === "sale" ? "Prodej" : item.properties.listing_type === "rent" ? "Pronájem" : "Dražba"}
                </span>
              </Link>
              <div className="dashboard-fav-info">
                <span className="dashboard-fav-price">{formatPrice(item.properties.price)}</span>
                <span className="dashboard-fav-meta">
                  {item.properties.rooms_label} &middot; {item.properties.area} m²
                </span>
                <span className="dashboard-fav-location">{item.properties.location_label}</span>
              </div>
              <button
                type="button"
                className="dashboard-fav-remove"
                onClick={() => handleRemove(item.property_id)}
                title="Odebrat z oblíbených"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18" />
                  <path d="M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
