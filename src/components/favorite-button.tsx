"use client";

import { useAuth } from "@/components/auth-provider";
import { useFavorites } from "@/components/favorites-provider";

type FavoriteButtonProps = {
  propertyId: string;
};

export function FavoriteButton({ propertyId }: FavoriteButtonProps) {
  const { user } = useAuth();
  const { favoriteIds, toggle } = useFavorites();
  const favorited = favoriteIds.has(propertyId);

  async function handleToggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      window.location.href = `/prihlaseni?redirect=${encodeURIComponent(window.location.pathname)}`;
      return;
    }

    await toggle(propertyId);
  }

  return (
    <button
      type="button"
      className={`favorite-btn ${favorited ? "favorite-btn--active" : ""}`}
      onClick={handleToggle}
      title={favorited ? "Odebrat z obl\u00edben\u00fdch" : "P\u0159idat do obl\u00edben\u00fdch"}
      aria-label={favorited ? "Odebrat z obl\u00edben\u00fdch" : "P\u0159idat do obl\u00edben\u00fdch"}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill={favorited ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </button>
  );
}
