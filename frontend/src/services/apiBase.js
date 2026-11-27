// Where the two APIs live (#39).
//
// In development the Vite proxy (vite.config.js) forwards same-origin
// paths to the two Cloud Run services, so the defaults are those paths.
// A production build is served by a static host with no proxy, so it
// calls the services cross-origin: set VITE_MARKETLENS_API_URL and
// VITE_FORECASTING_API_URL at build time to the services' base URLs, and
// add the frontend's origin to each API's CORS allow-list
// (ALLOWED_ORIGINS and MARKETLENS_CORS_ORIGINS).

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

// The base URL to call: the configured value, or the dev proxy path when
// it is unset. A configured value must be an absolute https URL (http only
// for a local host) with no query or fragment; anything else throws, so a
// mistyped build setting fails loudly instead of sending requests and the
// user's ID token somewhere unexpected. Trailing slashes are dropped.
export function resolveApiBase(configured, devPath) {
  const value = typeof configured === "string" ? configured.trim() : "";
  if (!value) return devPath;

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`API base URL is not a valid URL: ${value}`);
  }

  const secure =
    url.protocol === "https:" ||
    (url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname));

  if (!secure) {
    throw new Error(
      `API base URL must use https (http only for localhost): ${value}`
    );
  }
  if (url.search || url.hash || url.username || url.password) {
    throw new Error(
      `API base URL must not contain credentials, a query or a fragment: ${value}`
    );
  }

  return (url.origin + url.pathname).replace(/\/+$/, "");
}
