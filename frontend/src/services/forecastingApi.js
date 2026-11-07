
const BASE_URL = "/api/forecasting/api/v1";

const SERVICE_UNAVAILABLE =
  "Sales forecasting is temporarily unavailable. Please try again in a moment.";

async function request(endpoint, options = {}) {
  let response;

  try {
    response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  } catch {
    throw new Error(SERVICE_UNAVAILABLE);
  }

  // A misconfigured proxy or server can answer with an HTML
  // page instead of JSON. Treat that as unavailable.
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  const result = isJson
    ? await response.json().catch(() => null)
    : null;

  if (!response.ok) {
    throw new Error(
      result?.error?.message ||
        `Forecasting request failed (${response.status})`
    );
  }

  if (!isJson || result === null) {
    throw new Error(SERVICE_UNAVAILABLE);
  }

  return result?.data ?? result;
}

// Retrieve existing products from the forecasting catalogue.
export function getForecastProducts(offset = 0, limit = 100) {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
  });

  return request(`/products?${params}`);
}

// Forecast a product using its attributes.
export function predictLaunch(product) {
  return request("/predictions/launch", {
    method: "POST",
    body: JSON.stringify(product),
  });
}

// Forecast monthly sales using an existing Product ID.
export function predictMonthly(productId) {
  return request("/predictions/monthly", {
    method: "POST",
    body: JSON.stringify({
      product_id: productId,
    }),
  });
}

// Forecast yearly sales using an existing Product ID.
export function predictYearly(productId, year = 2026) {
  return request("/predictions/yearly", {
    method: "POST",
    body: JSON.stringify({
      product_id: productId,
      year,
    }),
  });
}
