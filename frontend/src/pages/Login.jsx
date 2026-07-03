import { useState } from "react";
import { API_BASE_URL } from "../config";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading, login } = useAuth();

  const handleLogin = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const response = await res.json().catch(() => ({}));
        throw new Error(response.detail ?? "Invalid email or password");
      }

      const data = await res.json();
      await login(data.access_token);

      const destination = location.state?.from?.pathname ?? "/admin";
      navigate(destination, { replace: true });
    } catch (loginError) {
      setError(loginError.message ?? "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isLoading && user?.is_admin) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
      <form
        onSubmit={handleLogin}
        className="bg-gray-900 p-6 rounded-xl space-y-4 w-80"
      >
        <h2 className="text-xl">Admin Login</h2>

        {(error || location.state?.error) && (
          <p className="text-sm text-red-400" role="alert">
            {error || location.state.error}
          </p>
        )}

        <input
          type="email"
          className="w-full p-2 bg-gray-800 rounded"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />

        <input
          type="password"
          className="w-full p-2 bg-gray-800 rounded"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-green-600 p-2 rounded disabled:opacity-50"
        >
          {isSubmitting ? "Signing in…" : "Login"}
        </button>
      </form>
    </div>
  );
}
