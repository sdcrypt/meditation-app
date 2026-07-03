import { createContext, useContext, useEffect, useState } from "react";
import { API_BASE_URL } from "../config";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();

    fetch(`${API_BASE_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error("Session validation failed");
        return res.json();
      })
      .then((authenticatedUser) => {
        if (!authenticatedUser.is_admin) {
          throw new Error("Admin access required");
        }
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

  const login = async (token) => {
    localStorage.setItem("token", token);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Unable to validate the session");
      }

      const authenticatedUser = await res.json();
      if (!authenticatedUser.is_admin) {
        throw new Error("This account does not have admin access");
      }

      setUser(authenticatedUser);
      return authenticatedUser;
    } catch (error) {
      localStorage.removeItem("token");
      setUser(null);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
