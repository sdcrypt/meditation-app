import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "../config";
import { useAuth } from "./AuthContext";

const FavoritesContext = createContext(null);

export function FavoritesProvider({ children }) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [favorites, setFavorites] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [isLoading, setIsLoading] = useState(false);

  const loadFavorites = useCallback(async (signal) => {
    if (!user) {
      setFavorites([]);
      setFavoriteIds(new Set());
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/favorites/me`, {
        credentials: "include",
        signal,
      });
      if (!response.ok) throw new Error("Unable to load favorites");
      const data = await response.json();
      setFavorites(data.items ?? []);
      setFavoriteIds(new Set(data.meditation_ids ?? []));
    } catch (error) {
      if (error.name !== "AbortError") {
        setFavorites([]);
        setFavoriteIds(new Set());
      }
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isAuthLoading) return undefined;
    const controller = new AbortController();
    loadFavorites(controller.signal);
    return () => controller.abort();
  }, [isAuthLoading, loadFavorites]);

  const toggleFavorite = useCallback(async (meditation) => {
    if (!user) {
      return { requiresLogin: true };
    }

    const meditationId = meditation.id;
    const isSaved = favoriteIds.has(meditationId);

    setFavoriteIds((current) => {
      const next = new Set(current);
      if (isSaved) next.delete(meditationId);
      else next.add(meditationId);
      return next;
    });
    if (isSaved) {
      setFavorites((current) =>
        current.filter((item) => item.meditation_id !== meditationId)
      );
    }

    try {
      const response = await fetch(`${API_BASE_URL}/favorites/${meditationId}`, {
        method: isSaved ? "DELETE" : "POST",
        credentials: "include",
      });
      if (!response.ok && response.status !== 204) {
        throw new Error("Unable to update favorite");
      }

      if (!isSaved) {
        const savedFavorite = await response.json();
        setFavorites((current) => [
          savedFavorite,
          ...current.filter((item) => item.meditation_id !== meditationId),
        ]);
      }
      return { isSaved: !isSaved };
    } catch (error) {
      await loadFavorites();
      return { error: error.message };
    }
  }, [favoriteIds, loadFavorites, user]);

  const value = useMemo(() => ({
    favorites,
    favoriteIds,
    isLoading,
    isFavorite: (meditationId) => favoriteIds.has(meditationId),
    toggleFavorite,
    reloadFavorites: () => loadFavorites(),
  }), [favoriteIds, favorites, isLoading, loadFavorites, toggleFavorite]);

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}

export const useFavorites = () => {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error("useFavorites must be used within FavoritesProvider");
  }
  return context;
};
