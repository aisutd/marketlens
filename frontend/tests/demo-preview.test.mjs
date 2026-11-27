import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  DEMO_PRESETS,
  previewScore,
} from "../src/services/demoPreview.js";

// ========================================
// TEST CONFIGURATION
// ========================================

const INITIAL = DEMO_PRESETS[0];

const PRODUCT = {
  id: INITIAL.id,
  title: INITIAL.title,
  category: INITIAL.category,
  price: Number(INITIAL.price),
  originalPrice: Number(INITIAL.listPrice),
  stars: null,
  reviews: 0,
};

const PRICES = [
  9.99,
  12.99,
  14.99,
  19.99,
  24.99,
];

// ========================================
// PRODUCT PRESET TESTS
// ========================================

test("demo contains exactly three products", () => {
  assert.equal(DEMO_PRESETS.length, 3);

  assert.deepEqual(
    DEMO_PRESETS.map((preset) => preset.id),
    [
      "silicone-food-bags",
      "insulated-bottle",
      "car-phone-mount",
    ]
  );
});

test("demo presets have unique identifiers", () => {
  const identifiers = DEMO_PRESETS.map(
    (preset) => preset.id
  );

  assert.equal(
    new Set(identifiers).size,
    DEMO_PRESETS.length
  );
});

test("demo presets cannot be modified", () => {
  assert.ok(Object.isFrozen(DEMO_PRESETS));

  for (const preset of DEMO_PRESETS) {
    assert.ok(Object.isFrozen(preset));
  }
});

test("unsupported products are rejected", () => {
  assert.throws(
    () =>
      previewScore(
        {
          ...PRODUCT,
          id: "unsupported-product",
        },
        PRICES
      ),
    /Select one of the three available demo products/
  );
});

test("all three presets generate valid results", () => {
  for (const preset of DEMO_PRESETS) {
    const result = previewScore(
      {
        id: preset.id,
        title: preset.title,
        category: preset.category,
        price: Number(preset.price),
        originalPrice: Number(preset.listPrice),
        stars: null,
        reviews: 0,
      },
      PRICES
    );

    assert.ok(Number.isFinite(result.score));

    assert.ok(
      result.score >= 0 &&
      result.score <= 100
    );

    assert.equal(
      result.categoryName,
      preset.category
    );
  }
});

// ========================================
// SCORING TESTS
// ========================================

test("identical inputs produce identical results", () => {
  const first = previewScore(
    PRODUCT,
    PRICES
  );

  const second = previewScore(
    PRODUCT,
    PRICES
  );

  assert.deepEqual(first, second);
});

test("opportunity scores are bounded between 0 and 100", () => {
  const result = previewScore(
    PRODUCT,
    PRICES
  );

  assert.ok(
    result.score >= 0 &&
    result.score <= 100
  );

  assert.ok(
    result.curve.every(
      (point) =>
        Number.isFinite(point.score) &&
        point.score >= 0 &&
        point.score <= 100
    )
  );
});

test("changing selling price affects the preview score", () => {
  const original = previewScore(
    PRODUCT,
    PRICES
  );

  const expensive = previewScore(
    {
      ...PRODUCT,
      price: 100,
    },
    PRICES
  );

  assert.notEqual(
    original.score,
    expensive.score
  );
});

test("changing the original price affects the preview score", () => {
  const original = previewScore(
    PRODUCT,
    PRICES
  );

  const discounted = previewScore(
    {
      ...PRODUCT,
      originalPrice: 39.99,
    },
    PRICES
  );

  assert.notEqual(
    original.score,
    discounted.score
  );
});

// ========================================
// RATING AND REVIEW TESTS
// ========================================

test("products without reviews use the launch preview", () => {
  const result = previewScore(
    PRODUCT,
    PRICES
  );

  assert.equal(
    result.model,
    "launch"
  );
});

test("products with ratings and reviews use the full preview", () => {
  const result = previewScore(
    {
      ...PRODUCT,
      stars: 4.8,
      reviews: 100,
    },
    PRICES
  );

  assert.equal(
    result.model,
    "full"
  );
});

test("ratings and reviews affect preview results", () => {
  const original = previewScore(
    PRODUCT,
    PRICES
  );

  const reviewed = previewScore(
    {
      ...PRODUCT,
      stars: 4.8,
      reviews: 100,
    },
    PRICES
  );

  assert.notEqual(
    original.score,
    reviewed.score
  );
});

test("a rating without reviews uses the launch preview", () => {
  const result = previewScore(
    {
      ...PRODUCT,
      stars: 4.8,
      reviews: 0,
    },
    PRICES
  );

  assert.equal(
    result.model,
    "launch"
  );
});

test("reviews without a rating use the launch preview", () => {
  const result = previewScore(
    {
      ...PRODUCT,
      stars: null,
      reviews: 100,
    },
    PRICES
  );

  assert.equal(
    result.model,
    "launch"
  );
});

// ========================================
// FACTOR EXPLANATION TESTS
// ========================================

test("positive factors contain positive impacts", () => {
  const result = previewScore(
    PRODUCT,
    PRICES
  );

  assert.ok(
    result.reasonsUp.length > 0
  );

  assert.ok(
    result.reasonsUp.every(
      (factor) =>
        Number.isFinite(factor.impact) &&
        factor.impact > 0
    )
  );
});

test("negative factors contain negative impacts", () => {
  const result = previewScore(
    PRODUCT,
    PRICES
  );

  assert.ok(
    result.reasonsDown.length > 0
  );

  assert.ok(
    result.reasonsDown.every(
      (factor) =>
        Number.isFinite(factor.impact) &&
        factor.impact < 0
    )
  );
});

test("factor explanations contain at most three entries per direction", () => {
  const result = previewScore(
    {
      ...PRODUCT,
      stars: 4.8,
      reviews: 100,
    },
    PRICES
  );

  assert.ok(
    result.reasonsUp.length <= 3
  );

  assert.ok(
    result.reasonsDown.length <= 3
  );
});

// ========================================
// PRICE SIMULATION TESTS
// ========================================

test("the current price matches the opportunity score", () => {
  const result = previewScore(
    PRODUCT,
    PRICES
  );

  const current = result.curve.find(
    (point) =>
      point.price === PRODUCT.price
  );

  assert.ok(current);

  assert.equal(
    current.score,
    result.score
  );
});

test("the current price is included automatically", () => {
  const result = previewScore(
    PRODUCT,
    [
      5,
      10,
      20,
    ]
  );

  assert.ok(
    result.curve.some(
      (point) =>
        point.price === PRODUCT.price
    )
  );
});

test("duplicate price points are removed", () => {
  const result = previewScore(
    PRODUCT,
    [
      10,
      10,
      20,
      20,
      PRODUCT.price,
    ]
  );

  const prices = result.curve.map(
    (point) => point.price
  );

  assert.equal(
    prices.length,
    new Set(prices).size
  );
});

test("price curve is sorted in ascending order", () => {
  const result = previewScore(
    PRODUCT,
    [
      30,
      10,
      20,
    ]
  );

  const actual = result.curve.map(
    (point) => point.price
  );

  const expected = [...actual].sort(
    (a, b) => a - b
  );

  assert.deepEqual(
    actual,
    expected
  );
});

test("extreme prices produce bounded scores", () => {
  const result = previewScore(
    PRODUCT,
    [
      0.01,
      1,
      1000,
      100000,
    ]
  );

  assert.ok(
    result.curve.every(
      (point) =>
        Number.isFinite(point.score) &&
        point.score >= 0 &&
        point.score <= 100
    )
  );
});

test("invalid price points are excluded", () => {
  const result = previewScore(
    PRODUCT,
    [
      -1,
      0,
      NaN,
      Infinity,
      100001,
      10,
    ]
  );

  assert.ok(
    result.curve.every(
      (point) =>
        Number.isFinite(point.price) &&
        point.price > 0 &&
        point.price <= 100000
    )
  );
});

// ========================================
// NETWORK ISOLATION TESTS
// ========================================

test("TryItLive does not import the scoring API", () => {
  const source = readFileSync(
    new URL(
      "../src/components/TryItLive.jsx",
      import.meta.url
    ),
    "utf8"
  );

  assert.doesNotMatch(
    source,
    /marketlensApi/
  );

  assert.doesNotMatch(
    source,
    /\bfetch\s*\(/
  );

  assert.doesNotMatch(
    source,
    /\/demo\//
  );

  assert.doesNotMatch(
    source,
    /\bpredictProduct\b/
  );

  assert.doesNotMatch(
    source,
    /\bgetPredictionReasons\b/
  );

  assert.doesNotMatch(
    source,
    /\bsimulatePrices\b/
  );

  assert.doesNotMatch(
    source,
    /\bgetCategories\b/
  );
});

test("preview engine does not directly use network or authentication services", () => {
  const source = readFileSync(
    new URL(
      "../src/services/demoPreview.js",
      import.meta.url
    ),
    "utf8"
  );

  assert.doesNotMatch(
    source,
    /\bfetch\s*\(/
  );

  assert.doesNotMatch(
    source,
    /\bXMLHttpRequest\b/
  );

  assert.doesNotMatch(
    source,
    /marketlensApi/
  );

  assert.doesNotMatch(
    source,
    /firebase/
  );

  assert.doesNotMatch(
    source,
    /\/demo\//
  );
});

// ========================================
// LANDING PAGE BRANDING TESTS
// ========================================

test("landing page retains Try it live branding", () => {
  const source = readFileSync(
    new URL(
      "../src/pages/LandingPage.jsx",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(
    source,
    /eyebrow="Try it live"/
  );

  assert.match(
    source,
    /<TryItLive\s*\/>/
  );
});
