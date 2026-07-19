import { useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE_URL } from "../config";
import { csrfFetch } from "../utils/authFetch";

const getErrorMessage = (payload, fallback) => {
  if (typeof payload?.detail === "string") return payload.detail;
  if (Array.isArray(payload?.detail)) {
    return payload.detail.map((item) => item.msg).join(". ");
  }
  return fallback;
};

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setResult(null);
    setIsSubmitting(true);
    try {
      const response = await csrfFetch(`${API_BASE_URL}/auth/password-reset/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(getErrorMessage(data, "Unable to prepare reset link"));
      }
      setResult(data);
    } catch (requestError) {
      setError(requestError.message || "Unable to prepare reset link");
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
          <blockquote>“Begin again, gently.”</blockquote>
        </div>
      </section>

      <section className="auth-form-panel">
        <div className="auth-form-wrap">
          <p className="eyebrow">Password reset</p>
          <h1>Find your way back in.</h1>
          <p className="auth-form-intro">
            Enter your account email. If it belongs to an active account, we will
            send a secure reset link.
          </p>

          {error && <div className="auth-error" role="alert">{error}</div>}
          {result && (
            <div className="auth-success" role="status">
              <p>{result.message}</p>
              {result.reset_url && (
                <Link to={new URL(result.reset_url).pathname + new URL(result.reset_url).search}>
                  Open local reset link
                </Link>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <label>
              <span>Email address</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
                required
              />
            </label>
            <button className="auth-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Preparing link…" : "Send reset link"}
            </button>
          </form>
          <small className="auth-privacy">
            Remembered it? <Link to="/login">Return to sign in</Link>
          </small>
        </div>
      </section>
    </main>
  );
}
