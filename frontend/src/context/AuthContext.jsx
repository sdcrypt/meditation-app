import { createContext, useContext, useEffect, useState } from "react";
import { API_BASE_URL } from "../config";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

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
      .then((authenticatedUser) => {
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

  const login = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Unable to validate the session");
      }

      const authenticatedUser = await res.json();
      setUser(authenticatedUser);
      return authenticatedUser;
    } catch (error) {
      setUser(null);
      throw error;
    }
  };

  const logout = async () => {
    localStorage.removeItem("token");
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Local logout still clears UI state if the network is unavailable.
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
