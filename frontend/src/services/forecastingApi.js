
const BASE_URL = "/api/forecasting/api/v1";

async function request(endpoint, options = {}) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      result?.error?.message ||
        `Forecasting request failed (${response.status})`
    );
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
