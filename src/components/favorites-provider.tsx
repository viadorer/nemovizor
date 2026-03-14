"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";
import { getFavoriteIds, addFavorite as addFav, removeFavorite as removeFav } from "@/lib/favorites";

type FavoritesContextValue = {
  favoriteIds: Set<string>;
  toggle: (propertyId: string) => Promise<void>;
  loading: boolean;
};

const FavoritesContext = createContext<FavoritesContextValue>({
  favoriteIds: new Set(),
  toggle: async () => {},
  loading: true,
});

export function useFavorites() {
  return useContext(FavoritesContext);
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setFavoriteIds(new Set());
      setLoading(false);
      return;
    }

    getFavoriteIds(user.id).then((ids) => {
      setFavoriteIds(new Set(ids));
      setLoading(false);
    });
  }, [user]);

  const toggle = useCallback(async (propertyId: string) => {
    if (!user) return;

    const isFav = favoriteIds.has(propertyId);

    // Optimistic update
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (isFav) next.delete(propertyId);
      else next.add(propertyId);
      return next;
    });

    const success = isFav
      ? await removeFav(user.id, propertyId)
      : await addFav(user.id, propertyId);

    if (!success) {
      // Revert
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (isFav) next.add(propertyId);
        else next.delete(propertyId);
        return next;
      });
    }
  }, [user, favoriteIds]);

  return (
    <FavoritesContext.Provider value={{ favoriteIds, toggle, loading }}>
      {children}
    </FavoritesContext.Provider>
  );
}
