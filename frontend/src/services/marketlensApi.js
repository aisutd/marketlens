
import { categoryUsesReviews } from "../constants/reviewCategories";
import { ApiError, requestJson } from "./apiClient";
import { auth } from "./firebase";

const API_BASE_URL = "/api";

// ========================================
// BUILD PRODUCT PAYLOAD
// ========================================

function buildProductPayload(product) {
  const payload = {
    title: product.title.trim(),
    price: Number(product.price),
    category: Number(product.category),
  };

  if (product.originalPrice !== "") {
    payload.list_price = Number(product.originalPrice);
  }

  // Sent only as a pair. The API reads a missing value as 0, so reviews
  // alone would reach the full model as "N reviews, 0 stars". Without
  // the pair, the launch-time model scores it as a new product idea. The
  // same goes for categories with no reviews in the scorer's training data.

  if (
    categoryUsesReviews(product.category) &&
    Number.isSafeInteger(product.reviews) &&
    product.reviews > 0 &&
    product.stars >= 1
  ) {
    payload.reviews = product.reviews;
    payload.stars = product.stars;
  }

  return payload;
}

// FastAPI puts the reason in `detail`: a string, or a list of
// validation errors each with a `msg`.
function readDetail(body) {
  if (typeof body.detail === "string") {
    return body.detail;
  }

  if (Array.isArray(body.detail)) {
    return body.detail
      .map((item) => item?.msg)
      .filter(Boolean)
      .join("; ");
  }

  return "";
}

// ========================================
// API REQUEST WITH FIREBASE AUTHENTICATION
// ========================================

// Every endpoint but /categories needs the signed-in user's Firebase ID
// token; requestJson then handles the timeout and error messages.
async function apiRequest(endpoint, options = {}) {
  const headers = new Headers(options.headers);

  if (endpoint !== "/categories") {
    const user = auth.currentUser;

    if (!user) {
      throw new ApiError(
        "You must be logged in to use MarketLens.",
        { kind: "auth", retryable: false }
      );
    }

    headers.set(
      "Authorization",
      `Bearer ${await user.getIdToken()}`
    );
  }

  return requestJson(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
    service: "scoring service",
    readError: readDetail,
  });
}

// ========================================
// JSON REQUEST OPTIONS
// ========================================

function jsonOptions(payload) {
  return {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  };
}

// ========================================
// GET PRODUCT CATEGORIES
// ========================================

export async function getCategories() {
  return apiRequest("/categories");
}

// ========================================
// PREDICT PRODUCT OPPORTUNITY
// ========================================

export async function predictProduct(product) {
  return apiRequest(
    "/predict",
    jsonOptions(buildProductPayload(product))
  );
}

// ========================================
// GET PREDICTION REASONS
// ========================================

export async function getPredictionReasons(product) {
  return apiRequest(
    "/reasons",
    jsonOptions(buildProductPayload(product))
  );
}

// ========================================
// RESCORE PRODUCT
// ========================================

export async function rescoreProduct(product, changes) {
  return apiRequest(
    "/rescore",
    jsonOptions({
      product: buildProductPayload(product),
      changes,
    })
  );
}

// ========================================
// SIMULATE PRODUCT PRICES
// ========================================

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
