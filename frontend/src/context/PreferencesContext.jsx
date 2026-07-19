import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { API_BASE_URL } from "../config";
import { csrfFetch } from "../utils/authFetch";
import { useAuth } from "./AuthContext";

const PreferencesContext = createContext(null);
const PREFERENCES_KEY = "still_meditation_preferences_v1";
const DISMISSED_KEY = "still_onboarding_dismissed";

const readPreferences = () => {
  try {
    return JSON.parse(localStorage.getItem(PREFERENCES_KEY));
  } catch {
    return null;
  }
};

const hasUsefulPreferences = (preferences) =>
  Boolean(
    preferences &&
    ((preferences.goals ?? []).length > 0 ||
      preferences.duration ||
      preferences.experience ||
      preferences.practiceTime)
  );

const toApiPreferences = (preferences) => ({
  goals: preferences.goals ?? [],
  preferred_duration: preferences.duration ?? "",
  experience_level: preferences.experience ?? "",
  preferred_practice_time: preferences.practiceTime ?? "",
});

const fromApiPreferences = (preferences) => {
  if (!preferences) return null;
  return {
    goals: preferences.goals ?? [],
    duration: preferences.preferred_duration ?? "",
    experience: preferences.experience_level ?? "",
    practiceTime: preferences.preferred_practice_time ?? "",
    version: 1,
    userId: preferences.user_id,
    updatedAt: preferences.updated_at,
  };
};

const saveLocalPreferences = (preferences) => {
  if (!preferences) {
    localStorage.removeItem(PREFERENCES_KEY);
    return;
  }
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
};

export function PreferencesProvider({ children }) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [preferences, setPreferences] = useState(readPreferences);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(
    () => localStorage.getItem(DISMISSED_KEY) === "true"
  );
  const openOnboarding = useCallback(() => setIsOnboardingOpen(true), []);
  const closeOnboarding = useCallback(() => setIsOnboardingOpen(false), []);

  useEffect(() => {
    if (isAuthLoading) return undefined;

    if (!user) {
      setPreferences(readPreferences());
      setIsSyncing(false);
      return undefined;
    }

    const controller = new AbortController();

    const syncPreferences = async () => {
      setIsSyncing(true);
      try {
        const localPreferences = readPreferences();
        const remoteResponse = await fetch(`${API_BASE_URL}/preferences/me`, {
          credentials: "include",
          signal: controller.signal,
        });
        if (!remoteResponse.ok) {
          throw new Error("Unable to load account preferences");
        }

        const remotePreferences = fromApiPreferences(await remoteResponse.json());
        const localBelongsToUser =
          localPreferences &&
          (!localPreferences.userId || localPreferences.userId === user.id);
        const localUpdatedAt = Date.parse(localPreferences?.updatedAt ?? "") || 0;
        const remoteUpdatedAt = Date.parse(remotePreferences?.updatedAt ?? "") || 0;

        let nextPreferences = remotePreferences;
        if (
          hasUsefulPreferences(localPreferences) &&
          localBelongsToUser &&
          (!remotePreferences || localUpdatedAt >= remoteUpdatedAt)
        ) {
          const saveResponse = await csrfFetch(`${API_BASE_URL}/preferences/me`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            signal: controller.signal,
            body: JSON.stringify(toApiPreferences(localPreferences)),
          });
          if (!saveResponse.ok) {
            throw new Error("Unable to save account preferences");
          }
          nextPreferences = fromApiPreferences(await saveResponse.json());
        }

        saveLocalPreferences(nextPreferences);
        setPreferences(nextPreferences);
      } catch (error) {
        if (error.name !== "AbortError") {
          setPreferences(readPreferences());
        }
      } finally {
        if (!controller.signal.aborted) setIsSyncing(false);
      }
    };

    syncPreferences();
    return () => controller.abort();
  }, [isAuthLoading, user]);

  const savePreferences = async (nextPreferences) => {
    const saved = {
      ...nextPreferences,
      version: 1,
      userId: user?.id,
      updatedAt: new Date().toISOString(),
    };
    saveLocalPreferences(saved);
    localStorage.removeItem(DISMISSED_KEY);
    setPreferences(saved);
    setIsDismissed(false);
    setIsOnboardingOpen(false);

    if (!user) return;

    try {
      const response = await csrfFetch(`${API_BASE_URL}/preferences/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(toApiPreferences(saved)),
      });
      if (!response.ok) throw new Error("Unable to save account preferences");
      const accountPreferences = fromApiPreferences(await response.json());
      saveLocalPreferences(accountPreferences);
      setPreferences(accountPreferences);
    } catch {
      // Keep the local copy so the UI still reflects the user's choices.
    }
  };

  const dismissOnboarding = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setIsDismissed(true);
    setIsOnboardingOpen(false);
  };

  return (
    <PreferencesContext.Provider
      value={{
        preferences,
        hasPreferences: Boolean(preferences),
        isSyncing,
        shouldPrompt: !isAuthLoading && !isSyncing && !preferences && !isDismissed,
        isOnboardingOpen,
        openOnboarding,
        closeOnboarding,
        dismissOnboarding,
        savePreferences,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export const usePreferences = () => {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error("usePreferences must be used within PreferencesProvider");
  }
  return context;
};
