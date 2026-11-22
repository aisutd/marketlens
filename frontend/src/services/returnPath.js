// ========================================
// WHERE TO GO AFTER SIGNING IN
// ========================================

export const DEFAULT_RETURN_PATH = "/discover";

const AUTH_PAGES = new Set(["/login", "/signup"]);

// ProtectedRoute sends signed-out users to /login with state={{ from: location }}.
// Return them to that page, but only to an in-app path: history state can be
// written by any script on the origin, so a full URL, a protocol-relative "//host"
// or a backslash path (which browsers treat like "//") falls back to Discover, as
// do the sign-in pages themselves.
export function returnPathFrom(state) {
  const from = state?.from;
  const pathname = typeof from?.pathname === "string" ? from.pathname : "";

  if (
    !pathname.startsWith("/") ||
    pathname.startsWith("//") ||
    pathname.includes("\\") ||
    AUTH_PAGES.has(pathname)
  ) {
    return DEFAULT_RETURN_PATH;
  }

  const search =
    typeof from.search === "string" && from.search.startsWith("?")
      ? from.search
      : "";

  const hash =
    typeof from.hash === "string" && from.hash.startsWith("#")
      ? from.hash
      : "";

  return pathname + search + hash;
}
