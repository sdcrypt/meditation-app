import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config";
import { useAuth } from "../context/AuthContext";

const getErrorMessage = (payload, fallback) => {
  if (typeof payload?.detail === "string") return payload.detail;
  if (Array.isArray(payload?.detail)) {
    return payload.detail.map((item) => item.msg).join(". ");
  }
  return fallback;
};

export default function Login() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading, login } = useAuth();

  const changeMode = (nextMode) => {
    setMode(nextMode);
    setError("");
    setPassword("");
    setConfirmPassword("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (mode === "register" && password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/auth/${mode === "register" ? "register" : "login"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            data,
            mode === "register" ? "Unable to create account" : "Unable to sign in"
          )
        );
      }

      const authenticatedUser = await login(data.access_token);
      const requestedPath = location.state?.from?.pathname;
      const destination = authenticatedUser.is_admin
        ? requestedPath || "/admin"
        : requestedPath && requestedPath !== "/admin"
          ? requestedPath
          : "/account";
      navigate(destination, { replace: true });
    } catch (authenticationError) {
      setError(authenticationError.message || "Authentication failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isLoading && user) {
    return <Navigate to={user.is_admin ? "/admin" : "/account"} replace />;
  }

  return (
    <main className="auth-page">
      <section className="auth-visual">
        <div className="auth-visual__sun" />
        <div className="auth-visual__ridge auth-visual__ridge--back" />
        <div className="auth-visual__ridge auth-visual__ridge--front" />
        <div className="auth-visual__copy">
          <p>still.</p>
          <blockquote>“The quieter you become, the more you are able to hear.”</blockquote>
        </div>
      </section>

      <section className="auth-form-panel">
        <div className="auth-form-wrap">
          <p className="eyebrow">{mode === "login" ? "Welcome back" : "Begin your journey"}</p>
          <h1>{mode === "login" ? "Return to your practice." : "Create your account."}</h1>
          <p className="auth-form-intro">
            {mode === "login"
              ? "Sign in to continue. Administrator accounts use this same form."
              : "Start with an email and password. Progress synchronization comes next."}
          </p>

          <div className="auth-tabs">
            <button className={mode === "login" ? "active" : ""} onClick={() => changeMode("login")}>Sign in</button>
            <button className={mode === "register" ? "active" : ""} onClick={() => changeMode("register")}>Create account</button>
          </div>

          {(error || location.state?.error) && (
            <div className="auth-error" role="alert">{error || location.state.error}</div>
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
            <label>
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                placeholder="Enter your password"
                minLength={mode === "register" ? 10 : 1}
                maxLength={128}
                required
              />
            </label>
            {mode === "register" && (
              <>
                <label>
                  <span>Confirm password</span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    placeholder="Repeat your password"
                    minLength={10}
                    maxLength={128}
                    required
                  />
                </label>
                <p className="auth-password-note">
                  Use at least 10 characters with uppercase, lowercase, and a number.
                </p>
              </>
            )}
            <button className="auth-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? mode === "register" ? "Creating account…" : "Signing in…"
                : mode === "register" ? "Create account" : "Sign in"}
            </button>
          </form>
          <small className="auth-privacy">Your email is used only for your Still account.</small>
        </div>
      </section>
    </main>
  );
}
