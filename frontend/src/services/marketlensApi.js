
const API_BASE_URL = "/api";

function buildProductPayload(product) {
  const payload = {
    title: product.title.trim(),
    price: Number(product.price),
    category: Number(product.category),
  };

  if (product.originalPrice !== "") {
    payload.list_price = Number(product.originalPrice);
  }

  // Left out when empty, so the API scores a product idea.
  if (Number.isSafeInteger(product.reviews)) {
    payload.reviews = product.reviews;
  }

  return payload;
}

async function apiRequest(endpoint, options = {}) {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, options);
  } catch {
    throw new Error(
      "Unable to connect to the MarketLens backend."
    );
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;

    try {
      const error = await response.json();

      if (Array.isArray(error.detail)) {
        message = error.detail
          .map((item) => item.msg)
          .join("; ");
      } else if (typeof error.detail === "string") {
        message = error.detail;
      }
    } catch {
      // Keep the HTTP error message.
    }

    throw new Error(message);
  }

  return response.json();
}

function jsonOptions(payload) {
  return {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  };
}

export async function getCategories() {
  return apiRequest("/categories");
}

export async function predictProduct(product) {
  return apiRequest(
    "/predict",
    jsonOptions(buildProductPayload(product))
  );
}

export async function getPredictionReasons(product) {
  return apiRequest(
    "/reasons",
    jsonOptions(buildProductPayload(product))
  );
}

export async function rescoreProduct(product, changes) {
  return apiRequest(
    "/rescore",
    jsonOptions({
      product: buildProductPayload(product),
      changes,
    })
  );
}

export async function simulatePrices(product, prices) {
  if (
    !Array.isArray(prices) ||
    prices.length < 1 ||
    prices.length > 20 ||
    !prices.every(
      (price) =>
        Number.isFinite(price) &&
        price > 0 &&
        price <= 100000
    )
  ) {
    throw new Error(
      "Provide between 1 and 20 valid prices."
    );
  }

  return apiRequest(
    "/what-if",
    jsonOptions({
      product: buildProductPayload(product),
      prices,
    })
  );
}
