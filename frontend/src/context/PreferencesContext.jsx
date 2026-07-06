import { createContext, useCallback, useContext, useState } from "react";

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

export function PreferencesProvider({ children }) {
  const [preferences, setPreferences] = useState(readPreferences);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(
    () => localStorage.getItem(DISMISSED_KEY) === "true"
  );
  const openOnboarding = useCallback(() => setIsOnboardingOpen(true), []);
  const closeOnboarding = useCallback(() => setIsOnboardingOpen(false), []);

  const savePreferences = (nextPreferences) => {
    const saved = {
      ...nextPreferences,
      version: 1,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(saved));
    localStorage.removeItem(DISMISSED_KEY);
    setPreferences(saved);
    setIsDismissed(false);
    setIsOnboardingOpen(false);
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
        shouldPrompt: !preferences && !isDismissed,
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
