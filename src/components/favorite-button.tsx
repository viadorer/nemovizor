"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { addFavorite, removeFavorite, isFavorite } from "@/lib/favorites";

type FavoriteButtonProps = {
  propertyId: string;
};

export function FavoriteButton({ propertyId }: FavoriteButtonProps) {
  const { user } = useAuth();
  const [favorited, setFavorited] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    isFavorite(user.id, propertyId).then(setFavorited);
  }, [user, propertyId]);

  async function handleToggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      window.location.href = `/prihlaseni?redirect=${encodeURIComponent(window.location.pathname)}`;
      return;
    }

    setLoading(true);
    const newState = !favorited;
    setFavorited(newState); // optimistic

    const success = newState
      ? await addFavorite(user.id, propertyId)
      : await removeFavorite(user.id, propertyId);

    if (!success) setFavorited(!newState); // revert
    setLoading(false);
  }

  return (
    <button
      type="button"
      className={`favorite-btn ${favorited ? "favorite-btn--active" : ""}`}
      onClick={handleToggle}
      disabled={loading}
      title={favorited ? "Odebrat z oblibenych" : "Pridat do oblibenych"}
      aria-label={favorited ? "Odebrat z oblibenych" : "Pridat do oblibenych"}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill={favorited ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </button>
  );
}
