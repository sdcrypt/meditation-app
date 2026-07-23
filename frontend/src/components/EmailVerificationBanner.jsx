import { Link } from "react-router-dom";
import { API_BASE_URL } from "../config";
import { useAuth } from "../context/AuthContext";
import { csrfFetch } from "../utils/authFetch";
import { useState } from "react";

export default function EmailVerificationBanner() {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [devLink, setDevLink] = useState("");

  if (!user || user.is_email_verified) return null;

  const resendVerification = async () => {
    setMessage("");
    setError("");
    setDevLink("");
    setIsSending(true);
    try {
      const response = await csrfFetch(`${API_BASE_URL}/auth/email-verification/resend`, {
        method: "POST",
        credentials: "include",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.detail || "Unable to send verification email.");
      }
      setMessage(payload.message || "Verification email sent.");
      if (payload.verification_url) setDevLink(payload.verification_url);
    } catch (resendError) {
      setError(resendError.message || "Unable to send verification email.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="email-verification-banner" role="status">
      <div>
        <strong>Verify your email</strong>
        <span>We sent a verification link to {user.email}. Verify to keep your account trusted.</span>
        {message && <em>{message}</em>}
        {error && <em className="is-error">{error}</em>}
        {devLink && <Link to={devLink.replace(window.location.origin, "")}>Open local verification link</Link>}
      </div>
      <button onClick={resendVerification} disabled={isSending}>
        {isSending ? "Sending…" : "Resend email"}
      </button>
    </div>
  );
}
