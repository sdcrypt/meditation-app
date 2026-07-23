import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { API_BASE_URL } from "../config";
import { useAuth } from "../context/AuthContext";
import { csrfFetch } from "../utils/authFetch";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const { refreshUser, user } = useAuth();
  const [status, setStatus] = useState("verifying");
  const [message, setMessage] = useState("Checking your verification link…");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setMessage("Verification link is missing a token.");
      return;
    }

    let isMounted = true;
    csrfFetch(`${API_BASE_URL}/auth/email-verification/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.detail || "Verification link is invalid or expired.");
        }
        if (isMounted) {
          setStatus("success");
          setMessage(payload.message || "Email verified successfully.");
        }
        if (user) await refreshUser().catch(() => {});
      })
      .catch((error) => {
        if (isMounted) {
          setStatus("error");
          setMessage(error.message || "Verification failed.");
        }
      });

    return () => {
      isMounted = false;
    };
  }, [refreshUser, searchParams, user]);

  return (
    <main className="verification-page">
      <section className={`verification-card verification-card--${status}`}>
        <p className="eyebrow">Email verification</p>
        <h1>
          {status === "success"
            ? "Your email is verified."
            : status === "error"
              ? "We could not verify this link."
              : "Verifying your email…"}
        </h1>
        <p>{message}</p>
        <div className="verification-actions">
          {status === "success" ? (
            <Link to={user ? "/account" : "/login"}>{user ? "Go to account" : "Sign in"}</Link>
          ) : (
            <>
              <Link to="/account">Go to account</Link>
              <Link to="/login">Sign in</Link>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
