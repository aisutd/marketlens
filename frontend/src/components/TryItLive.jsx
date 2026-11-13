
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  LoaderCircle,
  Sparkles,
} from "lucide-react";

import {
  getCategories,
  getPredictionReasons,
  predictProduct,
  simulatePrices,
} from "../services/marketlensApi";

import { categoryUsesReviews } from "../constants/reviewCategories";

const PRESETS = [
  {
    label: "Silicone food bags",
    title: "Reusable Silicone Food Storage Bags, 10 Pack, Leakproof",
    category: "Kitchen & Dining",
    price: "14.99",
    listPrice: "19.99",
  },
  {
    label: "Insulated bottle",
    title: "Stainless Steel Insulated Water Bottle 32oz, Leak Proof Lid",
    category: "Sports & Outdoors",
    price: "24.99",
    listPrice: "29.99",
  },
  {
    label: "Car phone mount",
    title: "Magnetic Phone Car Mount, Dashboard Holder Compatible with iPhone 15",
    category: "Cell Phones & Accessories",
    price: "15.99",
    listPrice: "21.99",
  },
];

const INITIAL = PRESETS[0];

const inputClass =
  "h-10 w-full rounded-md border border-input bg-card px-3 " +
  "text-sm text-foreground outline-none transition-colors " +
  "focus-visible:border-primary focus-visible:ring-1 " +
  "focus-visible:ring-primary disabled:opacity-50";

const labelClass =
  "mb-2 block text-sm font-medium text-foreground";

function toNumber(value) {
  if (String(value).trim() === "") return null;

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function makePriceSweep(price) {
  const factors = [
    0.4,
    0.55,
    0.7,
    0.85,
    1,
    1.15,
    1.3,
    1.5,
    1.8,
  ];

  const prices = factors.map((factor) =>
    Math.max(
      0.99,
      Math.round(price * factor * 100) / 100
    )
  );

  return [...new Set(prices)].sort(
    (a, b) => a - b
  );
}

function normalizeReasons(items) {
  if (!Array.isArray(items)) return [];

  return items
    .map((item, index) => ({
      feature: String(
        item?.feature || `factor-${index}`
      ),
      label: String(
        item?.label ||
        item?.feature ||
        "Model factor"
      ),
      impact: Number(item?.impact),
    }))
    .filter((item) =>
      Number.isFinite(item.impact)
    )
    .sort(
      (a, b) =>
        Math.abs(b.impact) -
        Math.abs(a.impact)
    )
    .slice(0, 3);
}

function normalizeCurve(response) {
  const items = Array.isArray(response)
    ? response
    : Array.isArray(response?.results)
      ? response.results
      : Array.isArray(response?.points)
        ? response.points
        : [];

  return items
    .map((item) => ({
      price: Number(item?.price),
      score: Number(
        item?.opportunity_score ?? item?.score
      ),
    }))
    .filter(
      (item) =>
        Number.isFinite(item.price) &&
        Number.isFinite(item.score)
    )
    .sort((a, b) => a.price - b.price);
}

function ScoreDial({
  score,
  caption = "out of 100",
}) {
  const value = Math.max(
    0,
    Math.min(100, Number(score) || 0)
  );

  const ticks = Array.from(
    { length: 11 },
    (_, index) => index * 10
  );

  return (
    <div className="relative">
      <svg
        viewBox="0 0 200 116"
        className="w-full"
        role="img"
        aria-label={`Opportunity score: ${value} out of 100`}
      >
        {ticks.map((tick) => {
          const angle =
            Math.PI - (tick / 100) * Math.PI;

          const outer = 92;
          const inner =
            tick % 50 === 0 ? 82 : 86;

          return (
            <line
              key={tick}
              x1={100 + outer * Math.cos(angle)}
              y1={104 - outer * Math.sin(angle)}
              x2={100 + inner * Math.cos(angle)}
              y2={104 - inner * Math.sin(angle)}
              className="stroke-muted-foreground"
              strokeWidth={1}
            />
          );
        })}

        <path
          d="M 24 104 A 76 76 0 0 1 176 104"
          fill="none"
          className="stroke-secondary"
          strokeWidth={12}
        />

        <path
          key={value}
          d="M 24 104 A 76 76 0 0 1 176 104"
          fill="none"
          pathLength={100}
          strokeDasharray="100"
          strokeDashoffset={100 - value}
          className="stroke-primary animate-sweep"
          style={{ "--dash-from": 100 }}
          strokeWidth={12}
        />
      </svg>

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
        <span className="font-display tabular text-6xl leading-none text-foreground">
          {value}
        </span>

        <span className="eyebrow mt-2 text-muted-foreground">
          {caption}
        </span>
      </div>
    </div>
  );
}

function FactorBars({ up = [], down = [] }) {
  const maximum = Math.max(
    0.0001,
    ...[...up, ...down].map((item) =>
      Math.abs(item.impact)
    )
  );

  function renderGroup(items, positive) {
    const color = positive
      ? "text-signal-up"
      : "text-signal-down";

    const fill = positive
      ? "bg-signal-up"
      : "bg-signal-down";

    return (
      <div>
        <p
          className={`eyebrow mb-3 flex items-center gap-1.5 ${color}`}
        >
          {positive ? (
            <ArrowUpRight size={14} />
          ) : (
            <ArrowDownRight size={14} />
          )}

          {positive
            ? "Pushing it up"
            : "Holding it back"}
        </p>

        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No factors returned.
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={item.feature}
                className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1"
              >
                <span className="truncate text-sm text-foreground">
                  {item.label}
                </span>

                <span
                  className={`font-mono tabular text-xs ${color}`}
                >
                  {positive ? "+" : "−"}
                  {Math.abs(item.impact).toFixed(2)}
                </span>

                <div className="col-span-2 h-1.5 bg-secondary">
                  <div
                    className={`h-full ${fill}`}
                    style={{
                      width: `${
                        (Math.abs(item.impact) /
                          maximum) *
                        100
                      }%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {renderGroup(up, true)}
      {renderGroup(down, false)}
    </div>
  );
}

function PriceCurve({ points, current }) {
  if (points.length < 2) return null;

  const width = 320;
  const height = 150;

  const pad = {
    left: 28,
    right: 10,
    top: 12,
    bottom: 26,
  };

  const first = points[0];
  const last = points[points.length - 1];

  const x = (price) =>
    pad.left +
    ((price - first.price) /
      (last.price - first.price || 1)) *
      (width - pad.left - pad.right);

  const y = (score) =>
    pad.top +
    (1 - score / 100) *
      (height - pad.top - pad.bottom);

  const line = points
    .map((point) =>
      `${x(point.price)},${y(point.score)}`
    )
    .join(" ");

  const area = [
    `${x(first.price)},${y(0)}`,
    line,
    `${x(last.price)},${y(0)}`,
  ].join(" ");

  const best = points.reduce((a, b) =>
    b.score > a.score ? b : a
  );

  const nearest = points.reduce((a, b) =>
    Math.abs(b.price - current) <
    Math.abs(a.price - current)
      ? b
      : a
  );

  return (
    <figure>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label="Opportunity score at different selling prices"
      >
        {[0, 50, 100].map((score) => (
          <g key={score}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y(score)}
              y2={y(score)}
              className="stroke-border"
              strokeDasharray="2 3"
            />

            <text
              x={pad.left - 6}
              y={y(score) + 3}
              textAnchor="end"
              className="fill-muted-foreground font-mono text-[9px]"
            >
              {score}
            </text>
          </g>
        ))}

        <polygon
          points={area}
          className="fill-primary/10"
        />

        <polyline
          points={line}
          fill="none"
          className="stroke-primary"
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {points.map((point) => (
          <circle
            key={point.price}
            cx={x(point.price)}
            cy={y(point.score)}
            r={2.5}
            className="fill-card stroke-primary"
            strokeWidth={1.5}
          />
        ))}

        <line
          x1={x(nearest.price)}
          x2={x(nearest.price)}
          y1={pad.top}
          y2={y(0)}
          className="stroke-foreground"
          strokeWidth={1}
        />

        <circle
          cx={x(nearest.price)}
          cy={y(nearest.score)}
          r={4}
          className="fill-foreground"
        />

        <text
          x={pad.left}
          y={height - 8}
          className="fill-muted-foreground font-mono text-[9px]"
        >
          ${first.price.toFixed(2)}
        </text>

        <text
          x={width - pad.right}
          y={height - 8}
          textAnchor="end"
          className="fill-muted-foreground font-mono text-[9px]"
        >
          ${last.price.toFixed(2)}
        </text>
      </svg>

      <figcaption className="mt-2 text-xs leading-relaxed text-muted-foreground">
        At your price, the tested score is{" "}
        <span className="font-mono text-foreground">
          {nearest.score}
        </span>
        . Best tested:{" "}
        <span className="font-mono text-foreground">
          {best.score}
        </span>{" "}
        at{" "}
        <span className="font-mono text-foreground">
          ${best.price.toFixed(2)}
        </span>
        .
      </figcaption>
    </figure>
  );
}

export default function TryItLive() {
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] =
    useState(true);
  const [categoriesError, setCategoriesError] =
    useState("");

  const [title, setTitle] = useState(INITIAL.title);
  const [category, setCategory] = useState(
    INITIAL.category
  );
  const [price, setPrice] = useState(INITIAL.price);
  const [listPrice, setListPrice] = useState(
    INITIAL.listPrice
  );
  const [stars, setStars] = useState("");
  const [reviews, setReviews] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);

  // Load categories from MarketLens.
  useEffect(() => {
    let active = true;

    async function loadCategories() {
      setCategoriesLoading(true);
      setCategoriesError("");

      try {
        const response = await getCategories();

        if (!active) return;

        const items = Array.isArray(response)
          ? response
          : Array.isArray(response?.categories)
            ? response.categories
            : [];

        setCategories(items);
      } catch (err) {
        if (active) {
          setCategoriesError(
            err.message ||
            "Categories are unavailable."
          );
        }
      } finally {
        if (active) {
          setCategoriesLoading(false);
        }
      }
    }

    loadCategories();

    return () => {
      active = false;
    };
  }, [attempt]);

  // Sort category data without changing state.
  const sortedCategories = useMemo(
    () =>
      [...categories].sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    [categories]
  );

  // Resolve a category from its ID or exact name.
  // No setState or extra effect is necessary.
  const chosenCategory = useMemo(() => {
    const selected = String(category).trim();

    return (
      sortedCategories.find(
        (item) =>
          String(item.id) === selected
      ) ||
      sortedCategories.find(
        (item) =>
          item.name.toLowerCase() ===
          selected.toLowerCase()
      ) ||
      null
    );
  }, [category, sortedCategories]);

  function resetResult() {
    setResult(null);
    setError("");
  }

  function applyPreset(preset) {
    setTitle(preset.title);
    setCategory(preset.category);
    setPrice(preset.price);
    setListPrice(preset.listPrice);
    setStars("");
    setReviews("");
    resetResult();
  }

  function changeValue(setter, value) {
    setter(value);
    resetResult();
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (loading) return;

    const sellingPrice = toNumber(price);
    const originalPrice = toNumber(listPrice);
    const rating = toNumber(stars);
    const reviewCount = toNumber(reviews);

    if (
      title.trim().length < 3 ||
      title.trim().length > 500
    ) {
      setError(
        "Enter a product title between 3 and 500 characters."
      );
      return;
    }

    if (!chosenCategory) {
      setError("Select a valid product category.");
      return;
    }

    if (
      sellingPrice === null ||
      sellingPrice <= 0 ||
      sellingPrice > 100000
    ) {
      setError("Enter a valid selling price.");
      return;
    }

    if (
      originalPrice !== null &&
      (originalPrice < sellingPrice ||
        originalPrice > 100000)
    ) {
      setError(
        'The "was" price must be at least the selling price.'
      );
      return;
    }

    if (
      rating !== null &&
      (rating < 1 || rating > 5)
    ) {
      setError(
        "Star rating must be between 1 and 5."
      );
      return;
    }

    if (
      reviewCount !== null &&
      (!Number.isSafeInteger(reviewCount) ||
        reviewCount < 0)
    ) {
      setError(
        "Review count must be a non-negative whole number."
      );
      return;
    }

    const useReviews =
      categoryUsesReviews(chosenCategory.id) &&
      rating !== null &&
      reviewCount !== null &&
      reviewCount > 0;

    const product = {
      title: title.trim(),
      category: chosenCategory.id,
      categoryName: chosenCategory.name,
      price: sellingPrice,
      originalPrice:
        originalPrice === null
          ? ""
          : originalPrice,
      stars: useReviews ? rating : null,
      reviews: useReviews ? reviewCount : 0,
    };

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const prediction = await predictProduct(
        product
      );

      const score = Number(
        prediction?.opportunity_score
      );

      if (
        !Number.isFinite(score) ||
        score < 0 ||
        score > 100
      ) {
        throw new Error(
          "The scoring API did not return a valid opportunity score."
        );
      }

      const [reasonsResponse, curveResponse] =
        await Promise.allSettled([
          getPredictionReasons(product),
          simulatePrices(
            product,
            makePriceSweep(sellingPrice)
          ),
        ]);

      const reasons =
        reasonsResponse.status === "fulfilled"
          ? reasonsResponse.value
          : null;

      const curve =
        curveResponse.status === "fulfilled"
          ? normalizeCurve(curveResponse.value)
          : [];

      setResult({
        score,
        probability: prediction?.probability,
        model:
          prediction?.model_used ||
          (useReviews ? "full" : "launch"),
        categoryName: chosenCategory.name,
        price: sellingPrice,
        reasonsUp: normalizeReasons(
          reasons?.reasons_up
        ),
        reasonsDown: normalizeReasons(
          reasons?.reasons_down
        ),
        curve,
        reasonsUnavailable:
          reasonsResponse.status === "rejected",
        curveUnavailable:
          curveResponse.status === "rejected",
      });
    } catch (err) {
      setError(
        err.message ||
        "The scoring service did not respond."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid border border-ink bg-card text-foreground shadow-offset lg:grid-cols-[1.05fr_1fr]">
      <form
        onSubmit={handleSubmit}
        className="space-y-5 border-b border-ink p-6 sm:p-8 lg:border-b-0 lg:border-r"
      >
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              disabled={loading}
              onClick={() => applyPreset(preset)}
              className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-ink hover:text-foreground disabled:opacity-50"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div>
          <label
            htmlFor="live-title"
            className={labelClass}
          >
            Listing title
          </label>

          <input
            id="live-title"
            className={inputClass}
            value={title}
            maxLength={500}
            disabled={loading}
            onChange={(event) =>
              changeValue(
                setTitle,
                event.target.value
              )
            }
          />
        </div>

        <div>
          <label
            htmlFor="live-category"
            className={labelClass}
          >
            Category
          </label>

          <select
            id="live-category"
            className={inputClass}
            value={
              chosenCategory
                ? String(chosenCategory.id)
                : ""
            }
            disabled={
              loading || categoriesLoading
            }
            onChange={(event) =>
              changeValue(
                setCategory,
                event.target.value
              )
            }
          >
            <option value="">
              {categoriesLoading
                ? "Loading categories..."
                : "Select category"}
            </option>

            {sortedCategories.map((item) => (
              <option
                key={item.id}
                value={item.id}
              >
                {item.name}
              </option>
            ))}
          </select>

          {categoriesError && (
            <div
              role="alert"
              className="mt-2 text-xs text-signal-down"
            >
              {categoriesError}

              <button
                type="button"
                onClick={() =>
                  setAttempt(
                    (previous) => previous + 1
                  )
                }
                className="ml-2 underline"
              >
                Retry
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="live-price"
              className={labelClass}
            >
              Price ($)
            </label>

            <input
              id="live-price"
              className={inputClass}
              inputMode="decimal"
              value={price}
              disabled={loading}
              onChange={(event) =>
                changeValue(
                  setPrice,
                  event.target.value
                )
              }
            />
          </div>

          <div>
            <label
              htmlFor="live-list-price"
              className={labelClass}
            >
              "Was" price ($)
            </label>

            <input
              id="live-list-price"
              className={inputClass}
              inputMode="decimal"
              placeholder="optional"
              value={listPrice}
              disabled={loading}
              onChange={(event) =>
                changeValue(
                  setListPrice,
                  event.target.value
                )
              }
            />
          </div>

          <div>
            <label
              htmlFor="live-stars"
              className={labelClass}
            >
              Star rating
            </label>

            <input
              id="live-stars"
              className={inputClass}
              inputMode="decimal"
              placeholder="none yet"
              value={stars}
              disabled={loading}
              onChange={(event) =>
                changeValue(
                  setStars,
                  event.target.value
                )
              }
            />
          </div>

          <div>
            <label
              htmlFor="live-reviews"
              className={labelClass}
            >
              Reviews
            </label>

            <input
              id="live-reviews"
              className={inputClass}
              inputMode="numeric"
              placeholder="none yet"
              value={reviews}
              disabled={loading}
              onChange={(event) =>
                changeValue(
                  setReviews,
                  event.target.value
                )
              }
            />
          </div>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          Leave stars and reviews empty for a
          new product idea. MarketLens will use
          its launch-time model.
        </p>

        {error && (
          <p
            role="alert"
            className="border border-signal-down bg-signal-down-soft p-3 text-sm text-signal-down"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={
            loading ||
            categoriesLoading ||
            sortedCategories.length === 0
          }
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-ink bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-offset transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-offset-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <LoaderCircle
              size={17}
              className="animate-spin"
            />
          ) : (
            <Sparkles size={17} />
          )}

          {loading
            ? "Scoring against the category..."
            : "Score this idea"}
        </button>
      </form>

      <div
        className="flex min-h-[420px] flex-col p-6 sm:p-8"
        aria-live="polite"
        aria-busy={loading}
      >
        {!result && !loading && (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="w-56 opacity-40">
              <ScoreDial
                score={0}
                caption="awaiting idea"
              />
            </div>

            <p className="mt-6 max-w-xs text-sm text-muted-foreground">
              Your score, the reasons behind it,
              and how it moves with price will
              show up here.
            </p>
          </div>
        )}

        {loading && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <LoaderCircle className="size-6 animate-spin text-primary" />

            <p className="text-sm text-muted-foreground">
              Comparing with real listings...
            </p>
          </div>
        )}

        {result && !loading && (
          <div className="animate-rise space-y-6">
            <div className="flex items-center justify-between gap-3">
              <span className="eyebrow text-muted-foreground">
                Opportunity Score
              </span>

              <span className="rounded-full border border-border px-2.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                {result.model === "launch"
                  ? "launch-time model"
                  : result.model === "full"
                    ? "full model"
                    : result.model}
              </span>
            </div>

            <div className="mx-auto w-60">
              <ScoreDial score={result.score} />
            </div>

            <p className="text-center text-sm text-muted-foreground">
              Opportunity score:{" "}
              <span className="font-medium text-foreground">
                {result.score}/100
              </span>
              {" · "}
              {result.categoryName}
            </p>

            <div className="border-t border-dashed border-border pt-5">
              {result.reasonsUp.length > 0 ||
              result.reasonsDown.length > 0 ? (
                <FactorBars
                  up={result.reasonsUp}
                  down={result.reasonsDown}
                />
              ) : (
                <p className="text-xs text-muted-foreground">
                  {result.reasonsUnavailable
                    ? "Factor explanations could not be loaded."
                    : "No explanation factors were returned."}
                </p>
              )}
            </div>

            <div className="border-t border-dashed border-border pt-5">
              <p className="eyebrow mb-2 text-muted-foreground">
                Score by price
              </p>

              {result.curve.length >= 2 ? (
                <PriceCurve
                  points={result.curve}
                  current={result.price}
                />
              ) : (
                <p className="text-xs text-muted-foreground">
                  {result.curveUnavailable
                    ? "Price simulations could not be loaded."
                    : "No price curve was returned."}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
