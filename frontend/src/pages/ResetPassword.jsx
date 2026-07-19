import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { API_BASE_URL } from "../config";
import { useAuth } from "../context/AuthContext";
import { csrfFetch } from "../utils/authFetch";

const getErrorMessage = (payload, fallback) => {
  if (typeof payload?.detail === "string") return payload.detail;
  if (Array.isArray(payload?.detail)) {
    return payload.detail.map((item) => item.msg).join(". ");
  }
  return fallback;
};

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (!token) {
      setError("Reset token is missing. Request a new reset link.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await csrfFetch(`${API_BASE_URL}/auth/password-reset/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(getErrorMessage(data, "Unable to reset password"));
      }
      const authenticatedUser = await login();
      navigate(authenticatedUser.is_admin ? "/admin" : "/account", { replace: true });
    } catch (requestError) {
      setError(requestError.message || "Unable to reset password");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-visual">
        <div className="auth-visual__sun" />
        <div className="auth-visual__ridge auth-visual__ridge--back" />
        <div className="auth-visual__ridge auth-visual__ridge--front" />
        <div className="auth-visual__copy">
          <p>still.</p>
          <blockquote>“A fresh start can be quiet.”</blockquote>
        </div>
      </section>

      <section className="auth-form-panel">
        <div className="auth-form-wrap">
          <p className="eyebrow">Choose new password</p>
          <h1>Reset your password.</h1>
          <p className="auth-form-intro">
            Use at least 10 characters with uppercase, lowercase, and a number.
          </p>

          {error && <div className="auth-error" role="alert">{error}</div>}
          {!token && (
            <div className="auth-error" role="alert">
              Reset token is missing. <Link to="/forgot-password">Request a new link.</Link>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <label>
              <span>New password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                placeholder="Enter a new password"
                minLength={10}
                maxLength={128}
                required
              />
            </label>
            <label>
              <span>Confirm password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                placeholder="Repeat the new password"
                minLength={10}
                maxLength={128}
                required
              />
            </label>
            <button className="auth-submit" type="submit" disabled={isSubmitting || !token}>
              {isSubmitting ? "Resetting…" : "Reset password"}
            </button>
          </form>
          <small className="auth-privacy">
            Need another link? <Link to="/forgot-password">Request password reset</Link>
          </small>
        </div>
      </section>
    </main>
  );
}
