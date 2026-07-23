import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { API_BASE_URL, DEVICE_ID } from "../config";
import { csrfFetch } from "../utils/authFetch";

const AuthContext = createContext();

const syncDeviceProgress = async () => {
  await csrfFetch(`${API_BASE_URL}/sessions/sync-device`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ device_id: Number(DEVICE_ID) }),
  });
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionMessage, setSessionMessage] = useState("");

  const refreshUser = useCallback(async () => {
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      credentials: "include",
    });

    if (!res.ok) {
      if (res.status === 401) {
        setSessionMessage("Your session has expired. Please sign in again.");
      }
      throw new Error("Unable to validate the session");
    }

    const authenticatedUser = await res.json();
    setUser(authenticatedUser);
    setSessionMessage("");
    return authenticatedUser;
  }, []);

  useEffect(() => {
    localStorage.removeItem("token");

    const controller = new AbortController();

    fetch(`${API_BASE_URL}/auth/me`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error("Session validation failed");
        return res.json();
      })
      .then(async (authenticatedUser) => {
        await syncDeviceProgress().catch(() => {});
        setUser(authenticatedUser);
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          localStorage.removeItem("token");
          setUser(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, []);

  const login = useCallback(async () => {
    try {
      const authenticatedUser = await refreshUser();
      await syncDeviceProgress().catch(() => {});
      return authenticatedUser;
    } catch (error) {
      setUser(null);
      throw error;
    }
  }, [refreshUser]);

  const logout = useCallback(async () => {
    localStorage.removeItem("token");
    try {
      await csrfFetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Local logout still clears UI state if the network is unavailable.
    }
    setUser(null);
    setSessionMessage("");
  }, []);

  const markSessionExpired = useCallback((message = "Your session has expired. Please sign in again.") => {
    localStorage.removeItem("token");
    setUser(null);
    setSessionMessage(message);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      login,
      refreshUser,
      logout,
      sessionMessage,
      markSessionExpired,
      clearSessionMessage: () => setSessionMessage(""),
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
