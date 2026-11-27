import { ApiError, requestJson } from "./apiClient";
import { auth } from "./firebase";

const BASE_URL = "/api/forecasting/api/v1";

// ========================================
// AUTHENTICATED API REQUEST
// ========================================

async function request(endpoint, options = {}) {
  const user = auth?.currentUser;

  if (!user) {
    throw new ApiError(
      "You must be logged in to use MarketLens.",
      { kind: "auth", retryable: false }
    );
  }

  const token = await user.getIdToken();

  const headers = new Headers(options.headers);

  // Content-Type only when there is a body: on a GET it is meaningless
  // and, off the dev proxy, turns every request into a CORS preflight
  // (#39).
  if (options.body !== undefined && options.body !== null) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("Authorization", `Bearer ${token}`);

  const result = await requestJson(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
    service: "forecasting service",
    readError: (body) => body?.error?.message || "",
  });

  return result?.data ?? result;
}

// ========================================
// GET FORECASTING PRODUCTS
// ========================================

export function getForecastProducts(offset = 0, limit = 100) {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
  });

  return request(`/products?${params}`);
}

// ========================================
// NEW PRODUCT LAUNCH FORECAST
// ========================================

export function predictLaunch(product) {
  return request("/predictions/launch", {
    method: "POST",
    body: JSON.stringify(product),
  });
}

// ========================================
// MONTHLY SALES FORECAST
// ========================================

export function predictMonthly(productId) {
  return request("/predictions/monthly", {
    method: "POST",
    body: JSON.stringify({
      product_id: productId,
    }),
  });
}

// ========================================
// YEARLY SALES FORECAST
// ========================================

export function predictYearly(productId, year = 2026) {
  return request("/predictions/yearly", {
    method: "POST",
    body: JSON.stringify({
      product_id: productId,
      year,
    }),
  });
}