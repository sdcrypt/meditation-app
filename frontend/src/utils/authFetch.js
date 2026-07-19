import { API_BASE_URL } from "../config";

export const isUnauthorized = (response) => response.status === 401 || response.status === 403;

export const sessionExpiredMessage = "Your session has expired. Please sign in again.";

const CSRF_COOKIE_NAME = "still_csrf";
let csrfTokenPromise = null;

const readCookie = (name) =>
  document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${name}=`))
    ?.split("=")
    .slice(1)
    .join("=") || "";

export const getCsrfToken = async () => {
  const existingToken = decodeURIComponent(readCookie(CSRF_COOKIE_NAME));
  if (existingToken) return existingToken;

  if (!csrfTokenPromise) {
    csrfTokenPromise = fetch(`${API_BASE_URL}/auth/csrf`, {
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to prepare secure request");
        const payload = await response.json();
        return payload.csrf_token;
      })
      .finally(() => {
        csrfTokenPromise = null;
      });
  }
  return csrfTokenPromise;
};

export const csrfFetch = async (url, options = {}) => {
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers || {});
  if (!["GET", "HEAD", "OPTIONS", "TRACE"].includes(method)) {
    headers.set("X-CSRF-Token", await getCsrfToken());
  }
  return fetch(url, {
    ...options,
    credentials: options.credentials || "include",
    headers,
  });
};
