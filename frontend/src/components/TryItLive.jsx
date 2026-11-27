import { useState } from "react";

import {
  ArrowDownRight,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";

import {
  DEMO_PRESETS,
  previewScore,
} from "../services/demoPreview.js";

import { factorName } from "../constants/scoreFactors";

const PRESETS = DEMO_PRESETS;

const INITIAL = PRESETS[0];

const inputClass =
  "h-10 w-full rounded-md border border-input bg-card px-3 " +
  "text-sm text-foreground outline-none transition-colors " +
  "focus-visible:border-primary focus-visible:ring-1 " +
  "focus-visible:ring-primary disabled:opacity-50";

// Title and category come from the chosen example and cannot be typed
// into, so they must not look like the editable fields below them.
const fixedClass =
  "h-10 w-full cursor-default rounded-md border border-dashed " +
  "border-border bg-muted px-3 text-sm text-muted-foreground " +
  "outline-none focus-visible:ring-1 focus-visible:ring-primary";

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
      0.01,
      Math.min(
        100000,
        Math.round(price * factor * 100) / 100
      )
    )
  );

  return [...new Set([...prices, price])].sort(
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
      label: factorName(item),
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
        aria-label={`Illustrative preview score: ${value} out of 100`}
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
        aria-label="Illustrative preview score at different selling prices"
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
        At your price, the preview score is{" "}
        <span className="font-mono text-foreground">
          {nearest.score}
        </span>
        . Best previewed:{" "}
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
  const [selectedPreset, setSelectedPreset] =
    useState(INITIAL);

  const [price, setPrice] = useState(
    INITIAL.price
  );

  const [listPrice, setListPrice] = useState(
    INITIAL.listPrice
  );

  const [stars, setStars] = useState("");
  const [reviews, setReviews] = useState("");

  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  function resetResult() {
    setResult(null);
    setError("");
  }

  function applyPreset(preset) {
    setSelectedPreset(preset);
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

  function handleSubmit(event) {
    event.preventDefault();

    const sellingPrice = toNumber(price);
    const originalPrice = toNumber(listPrice);
    const rating = toNumber(stars);
    const reviewCount = toNumber(reviews);

    if (
      sellingPrice === null ||
      sellingPrice <= 0 ||
      sellingPrice > 100000
    ) {
      setError("Enter a valid selling price.");
      return;
    }

    if (
      String(listPrice).trim() !== "" &&
      originalPrice === null
    ) {
      setError('Enter a valid "was" price.');
      return;
    }

    if (
      originalPrice !== null &&
      (
        originalPrice < sellingPrice ||
        originalPrice > 100000
      )
    ) {
      setError(
        'The "was" price must be at least the selling price.'
      );
      return;
    }

    if (
      String(stars).trim() !== "" &&
      rating === null
    ) {
      setError("Enter a valid star rating.");
      return;
    }

    if (
      rating !== null &&
      (
        rating < 1 ||
        rating > 5
      )
    ) {
      setError(
        "Star rating must be between 1 and 5."
      );
      return;
    }

    if (
      String(reviews).trim() !== "" &&
      reviewCount === null
    ) {
      setError("Enter a valid review count.");
      return;
    }

    if (
      reviewCount !== null &&
      (
        !Number.isSafeInteger(reviewCount) ||
        reviewCount < 0
      )
    ) {
      setError(
        "Review count must be a non-negative whole number."
      );
      return;
    }

    const useReviews =
      rating !== null &&
      reviewCount !== null &&
      reviewCount > 0;

    const product = {
      id: selectedPreset.id,

      title: selectedPreset.title,

      category: selectedPreset.category,

      price: sellingPrice,

      originalPrice:
        originalPrice === null
          ? ""
          : originalPrice,

      stars: useReviews
        ? rating
        : null,

      reviews: useReviews
        ? reviewCount
        : 0,
    };

    try {
      const preview = previewScore(
        product,
        makePriceSweep(sellingPrice)
      );

      setError("");

      setResult({
        ...preview,

        reasonsUp: normalizeReasons(
          preview.reasonsUp
        ),

        reasonsDown: normalizeReasons(
          preview.reasonsDown
        ),
      });
    } catch {
      setResult(null);

      setError(
        "The preview could not be generated. Select a demo product and try again."
      );
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
              key={preset.id}
              type="button"
              aria-pressed={
                selectedPreset.id === preset.id
              }
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
            className={fixedClass}
            value={selectedPreset.title}
            aria-describedby="live-fixed-hint"
            readOnly
          />
        </div>

        <div>
          <label
            htmlFor="live-category"
            className={labelClass}
          >
            Category
          </label>

          <input
            id="live-category"
            className={fixedClass}
            value={selectedPreset.category}
            aria-describedby="live-fixed-hint"
            readOnly
          />

          <p
            id="live-fixed-hint"
            className="mt-2 text-xs text-muted-foreground"
          >
            Title and category are set by the example
            you pick above.
          </p>
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
          Choose an example product and adjust its
          details to explore illustrative scores.
          Leave stars and reviews empty for a new
          product idea. Sign in to analyze your own
          products in real time.
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
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-ink bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-offset transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-offset-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkles size={17} />

          Preview the score
        </button>
      </form>

      <div
        className="flex min-h-[420px] flex-col p-6 sm:p-8"
        aria-live="polite"
      >
        {!result && (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="w-56 opacity-40">
              <ScoreDial
                score={0}
                caption="awaiting preview"
              />
            </div>

            <p className="mt-6 max-w-xs text-sm text-muted-foreground">
              An illustrative score, the factors
              behind it, and how it moves with
              price will show up here.
            </p>
          </div>
        )}

        {result && (
          <div className="animate-rise space-y-6">
            <div className="flex items-center justify-between gap-3">
              <span className="eyebrow text-muted-foreground">
                Preview score
              </span>

              <span className="rounded-full border border-border px-2.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                {result.model === "launch"
                  ? "launch-time preview"
                  : "full-model preview"}
              </span>
            </div>

            <div className="mx-auto w-60">
              <ScoreDial score={result.score} />
            </div>

            <p className="text-center text-sm text-muted-foreground">
              Illustrative score:{" "}
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
                  No factor moved this example's score.
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
                  Not enough price points to draw a curve.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}