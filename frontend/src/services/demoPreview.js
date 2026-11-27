// Browser-only interactive preview for the landing page.
//
// All scores and scoring coefficients are illustrative.
// Only the three predefined products are supported.
// No API requests or trained ML models are used.

// ========================================
// DEMO PRODUCT PRESETS
// ========================================

export const DEMO_PRESETS = Object.freeze([
  Object.freeze({
    id: "silicone-food-bags",
    label: "Silicone food bags",
    title: "Reusable Silicone Food Storage Bags, 10 Pack, Leakproof",
    category: "Kitchen & Dining",
    price: "14.99",
    listPrice: "19.99",
    referencePrice: 14.99,
    baseScore: 68,
  }),

  Object.freeze({
    id: "insulated-bottle",
    label: "Insulated bottle",
    title: "Stainless Steel Insulated Water Bottle 32oz, Leak Proof Lid",
    category: "Sports & Outdoors",
    price: "24.99",
    listPrice: "29.99",
    referencePrice: 24.99,
    baseScore: 74,
  }),

  Object.freeze({
    id: "car-phone-mount",
    label: "Car phone mount",
    title: "Magnetic Phone Car Mount, Dashboard Holder Compatible with iPhone 15",
    category: "Cell Phones & Accessories",
    price: "15.99",
    listPrice: "21.99",
    referencePrice: 15.99,
    baseScore: 61,
  }),
]);

// ========================================
// SCORING UTILITIES
// ========================================

function clampScore(value) {
  return Math.max(
    0,
    Math.min(100, Math.round(value))
  );
}

function createReason(label, impact) {
  return {
    feature: label,
    label,
    impact: Number(impact.toFixed(2)),
  };
}

// ========================================
// LOCAL PREVIEW SCORING
// ========================================

export function previewScore(product, prices) {
  const preset = DEMO_PRESETS.find(
    (item) => item.id === product.id
  );

  if (!preset) {
    throw new Error(
      "Select one of the three available demo products."
    );
  }

  const hasReviews =
    product.stars !== null &&
    product.stars !== undefined &&
    product.reviews > 0;

  const titleImpact = 5;

  const competitionImpact = -4;

  const ratingImpact = hasReviews
    ? (product.stars - 3.5) * 7
    : 0;

  const reviewImpact = hasReviews
    ? Math.min(
        10,
        Math.log10(product.reviews + 1) * 3
      )
    : 0;

  // ========================================
  // PRICE IMPACT
  // ========================================

  function priceImpact(price) {
    return (
      10 -
      Math.min(
        45,
        Math.abs(
          Math.log(
            price / preset.referencePrice
          )
        ) * 24
      )
    );
  }

  // ========================================
  // DISCOUNT IMPACT
  // ========================================

  function discountImpact(price) {
    if (product.originalPrice > price) {
      return Math.min(
        6,
        (
          1 -
          price / product.originalPrice
        ) * 20
      );
    }

    return -2;
  }

  // ========================================
  // OPPORTUNITY SCORE
  // ========================================

  function scoreAtPrice(price) {
    return clampScore(
      preset.baseScore +
        titleImpact +
        competitionImpact +
        ratingImpact +
        reviewImpact +
        priceImpact(price) +
        discountImpact(price)
    );
  }

  // ========================================
  // ILLUSTRATIVE FACTOR EXPLANATIONS
  // ========================================

  const factors = [
    createReason(
      "title wording",
      titleImpact / 10
    ),

    createReason(
      "category size",
      competitionImpact / 10
    ),

    createReason(
      "price",
      priceImpact(product.price) / 10
    ),

    createReason(
      "discount",
      discountImpact(product.price) / 10
    ),
  ];

  if (hasReviews) {
    factors.push(
      createReason(
        "star rating",
        ratingImpact / 10
      ),

      createReason(
        "review count",
        reviewImpact / 10
      )
    );
  }

  const reasonsUp = factors
    .filter((factor) => factor.impact > 0)
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 3);

  const reasonsDown = factors
    .filter((factor) => factor.impact < 0)
    .sort((a, b) => a.impact - b.impact)
    .slice(0, 3);

  // ========================================
  // PRICE SIMULATION
  // ========================================

  const curve = [
    ...new Set([
      ...prices,
      product.price,
    ]),
  ]
    .filter(
      (price) =>
        Number.isFinite(price) &&
        price > 0 &&
        price <= 100000
    )
    .sort((a, b) => a - b)
    .map((price) => ({
      price,
      score: scoreAtPrice(price),
    }));

  // ========================================
  // PREVIEW RESPONSE
  // ========================================

  return {
    score: scoreAtPrice(product.price),

    model: hasReviews
      ? "full"
      : "launch",

    categoryName: preset.category,

    price: product.price,

    reasonsUp,

    reasonsDown,

    curve,
  };
}
