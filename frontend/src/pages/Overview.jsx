
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getPredictionReasons } from "../services/marketlensApi";
import OpportunityGauge from "../components/OpportunityGauge";

// ----------------------------------------
// FORMATTING
// ----------------------------------------

const currency = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);

function formatMetric(metric) {
  if (
    !metric ||
    metric.value == null ||
    !Number.isFinite(Number(metric.value))
  ) {
    return "—";
  }

  const value = Number(metric.value);

  if (metric.unit === "USD") {
    return currency(value);
  }

  if (metric.unit === "%") {
    return `${value.toFixed(2)}%`;
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

// ----------------------------------------
// SCORING REASON CHIPS
// ----------------------------------------

function ScoreChips({ reasons }) {
  if (!reasons) return null;

  const positive = Array.isArray(
    reasons.reasons_up
  )
    ? reasons.reasons_up.slice(0, 3)
    : [];

  const negative = Array.isArray(
    reasons.reasons_down
  )
    ? reasons.reasons_down.slice(0, 3)
    : [];

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {positive.map((reason, index) => (
        <span
          key={`positive-${index}`}
          className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-medium text-green-800"
        >
          + {reason.label || reason.feature}
        </span>
      ))}

      {negative.map((reason, index) => (
        <span
          key={`negative-${index}`}
          className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-800"
        >
          − {reason.label || reason.feature}
        </span>
      ))}
    </div>
  );
}

// ----------------------------------------
// FACTOR CARD
// ----------------------------------------

function FactorCard({ reason, positive }) {
  const impact = Number(reason.impact);

  const validImpact =
    reason.impact != null &&
    Number.isFinite(impact);

  return (
    <div className="rounded-lg border border-[#D7E0EB] bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#25334A]">
            {reason.label ||
              reason.feature ||
              "Factor"}
          </p>

          {reason.feature && (
            <p className="mt-1 text-xs text-[#61738B]">
              {reason.feature}
            </p>
          )}
        </div>

        {validImpact && (
          <span
            className={`shrink-0 rounded-md px-3 py-1 text-sm font-semibold ${
              positive
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {impact > 0 ? "+" : ""}
            {impact.toFixed(3)}
          </span>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------
// FORECAST METRIC CARD
// ----------------------------------------

function MetricCard({ label, metric }) {
  const range = metric?.range;

  const validRange =
    Array.isArray(range) &&
    range.length === 2 &&
    range.every(
      (value) =>
        value != null &&
        Number.isFinite(Number(value))
    ) &&
    metric?.value != null &&
    Number(range[0]) <= Number(range[1]) &&
    Number(range[0]) <= Number(metric.value) &&
    Number(metric.value) <= Number(range[1]);

  return (
    <div className="min-h-[120px] rounded-lg border border-[#D5DADF] bg-white p-5">
      <p className="text-sm font-semibold text-[#475569]">
        {label}
      </p>

      <p className="mt-3 text-[27px] font-bold text-[#0F172A]">
        {formatMetric(metric)}
      </p>

      {validRange && (
        <p className="mt-2 text-xs text-[#61738B]">
          Estimated range:{" "}
          {formatMetric({
            value: range[0],
            unit: metric.unit,
          })}
          {" – "}
          {formatMetric({
            value: range[1],
            unit: metric.unit,
          })}
        </p>
      )}

      {range && !validRange && (
        <p className="mt-2 text-xs text-[#61738B]">
          Estimated range unavailable.
        </p>
      )}
    </div>
  );
}

// ----------------------------------------
// PRICE SCENARIO PREVIEW
// ----------------------------------------

function PriceScenarioPreview({ product }) {
  const originalPrice = Number(product.price);

  const [selectedPrice, setSelectedPrice] =
    useState(() => String(product.price));

  const minPrice = Math.max(
    0.01,
    Number(
      Math.min(
        100000,
        originalPrice * 0.5
      ).toFixed(2)
    )
  );

  const maxPrice = Math.min(
    100000,
    Number(
      Math.max(
        originalPrice * 1.5,
        minPrice
      ).toFixed(2)
    )
  );

  const numericPrice = Number(selectedPrice);

  const validPrice =
    selectedPrice.trim() !== "" &&
    Number.isFinite(numericPrice) &&
    numericPrice >= 0.01 &&
    numericPrice <= 100000;

  const priceChange =
    validPrice && originalPrice > 0
      ? (numericPrice / originalPrice - 1) * 100
      : null;

  return (
    <section className="mt-7 rounded-xl border border-[#D5DADF] bg-white p-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <h2 className="text-xl font-semibold text-[#25334A]">
            Explore price scenarios
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#61738B]">
            Preview a different selling price,
            then open the What-If simulator to
            calculate opportunity scores and
            profitability.
          </p>
        </div>

        <Link
          to="/launch-feasibility"
          state={{
            suggestedPrice: validPrice
              ? numericPrice
              : originalPrice,
          }}
          aria-disabled={!validPrice}
          tabIndex={validPrice ? undefined : -1}
          className={`shrink-0 rounded-lg px-6 py-3 text-center text-sm font-semibold ${
            validPrice
              ? "bg-[#FFD45A] text-[#25334A] hover:bg-[#F5C842]"
              : "pointer-events-none bg-slate-200 text-slate-400"
          }`}
        >
          Explore Price Scenarios →
        </Link>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs text-[#61738B]">
                Original price
              </p>

              <p className="mt-2 text-xl font-semibold text-[#25334A]">
                {currency(originalPrice)}
              </p>
            </div>

            <div>
              <label
                htmlFor="preview-price"
                className="text-xs text-[#61738B]"
              >
                Scenario price
              </label>

              <div className="mt-2 flex items-center gap-2">
                <span className="font-semibold">
                  $
                </span>

                <input
                  id="preview-price"
                  type="number"
                  min="0.01"
                  max="100000"
                  step="0.01"
                  value={selectedPrice}
                  onChange={(event) =>
                    setSelectedPrice(
                      event.target.value
                    )
                  }
                  className="h-11 w-32 rounded-lg border border-[#D7E0EB] px-3 text-base font-semibold outline-none focus:border-[#193B66]"
                />
              </div>
            </div>
          </div>

          <input
            type="range"
            min={minPrice}
            max={maxPrice}
            step="0.01"
            value={
              validPrice
                ? Math.max(
                    minPrice,
                    Math.min(
                      maxPrice,
                      numericPrice
                    )
                  )
                : originalPrice
            }
            onChange={(event) =>
              setSelectedPrice(
                event.target.value
              )
            }
            disabled={minPrice >= maxPrice}
            aria-label="Preview selling price"
            className="mt-6 w-full cursor-pointer accent-[#193B66]"
          />

          <div className="mt-2 flex justify-between text-xs text-[#61738B]">
            <span>{currency(minPrice)}</span>
            <span>{currency(maxPrice)}</span>
          </div>
        </div>

        <div className="rounded-lg bg-[#F6F9FD] p-5">
          <p className="text-sm text-[#61738B]">
            Price adjustment
          </p>

          <p className="mt-3 text-3xl font-bold text-[#193B66]">
            {priceChange === null
              ? "—"
              : `${
                  priceChange > 0 ? "+" : ""
                }${priceChange.toFixed(1)}%`}
          </p>

          <p className="mt-3 text-sm text-[#61738B]">
            {validPrice
              ? `Scenario price: ${currency(
                  numericPrice
                )}`
              : "Enter a valid scenario price."}
          </p>

          <button
            type="button"
            onClick={() =>
              setSelectedPrice(
                String(originalPrice)
              )
            }
            className="mt-4 text-sm font-semibold text-[#193B66] underline"
          >
            Reset price
          </button>
        </div>
      </div>

      <p className="mt-5 text-xs leading-5 text-[#61738B]">
        This preview does not calculate a
        new opportunity score or modify any
        forecast. The selected price will be
        carried into the What-If simulator.
      </p>
    </section>
  );
}

// ----------------------------------------
// PRODUCT OVERVIEW
// ----------------------------------------

export default function Overview({
  product,
  prediction,
  forecast,
}) {
  const [showExplanations, setShowExplanations] =
    useState(false);

  const [loadedReasons, setLoadedReasons] =
    useState(null);

  const [loadingReasons, setLoadingReasons] =
    useState(false);

  const [reasonsError, setReasonsError] =
    useState("");

  const [retryCount, setRetryCount] =
    useState(0);

  const [launchTimeframe, setLaunchTimeframe] =
    useState("12m");

  const hasScore =
    prediction?.opportunity_score != null &&
    Number.isFinite(
      Number(prediction.opportunity_score)
    );

  const launch =
    forecast?.type === "launch"
      ? forecast.launch
      : null;

  const predictions = launch?.predictions;

  const hasProductResult =
    Boolean(product) &&
    (hasScore || Boolean(launch));

  const productName =
    product?.title ||
    launch?.input?.name ||
    "Selected product";

  const reasons =
    loadedReasons?.product === product &&
    loadedReasons?.prediction === prediction
      ? loadedReasons.data
      : null;

  // ----------------------------------------
  // LOAD SCORE EXPLANATIONS
  // ----------------------------------------

  useEffect(() => {
    if (
      !hasScore ||
      !product?.title ||
      reasons ||
      reasonsError
    ) {
      return;
    }

    let active = true;

    async function loadReasons() {
      setLoadingReasons(true);

      try {
        const data =
          await getPredictionReasons(product);

        if (active) {
          setLoadedReasons({
            product,
            prediction,
            data,
          });

          setReasonsError("");
        }
      } catch (err) {
        if (active) {
          setReasonsError(
            err.message ||
              "Unable to load score explanations."
          );
        }
      } finally {
        if (active) {
          setLoadingReasons(false);
        }
      }
    }

    loadReasons();

    return () => {
      active = false;
    };
  }, [
    hasScore,
    product,
    prediction,
    reasons,
    reasonsError,
    retryCount,
  ]);

  function retryExplanations() {
    setReasonsError("");
    setRetryCount(
      (previous) => previous + 1
    );
  }

  const positiveReasons = Array.isArray(
    reasons?.reasons_up
  )
    ? reasons.reasons_up
    : [];

  const negativeReasons = Array.isArray(
    reasons?.reasons_down
  )
    ? reasons.reasons_down
    : [];

  const isTwelveMonths =
    launchTimeframe === "12m";

  // ----------------------------------------
  // LAUNCH METRICS FOR OLDER SAVED RESULTS
  // ----------------------------------------

  const launchMetrics = isTwelveMonths
    ? [
        {
          label: "Units sold — first 12 months",
          metric: predictions?.units_sold_12m,
        },
        {
          label: "Revenue — first 12 months",
          metric: predictions?.revenue_12m,
        },
        {
          label: "Net profit — first 12 months",
          metric: predictions?.profit_12m,
        },
        {
          label: "Profit margin — first 12 months",
          metric: predictions?.margin_pct_12m,
        },
        {
          label: "ROI — first 12 months",
          metric: predictions?.roi_pct_12m,
        },
        {
          label: "Average selling price",
          metric: predictions?.avg_price_12m,
        },
      ]
    : [
        {
          label: "Units sold — first 24 months",
          metric: predictions?.units_sold_24m,
        },
        {
          label: "Revenue — first 24 months",
          metric: predictions?.revenue_24m,
        },
        {
          label: "Net profit — first 24 months",
          metric: predictions?.profit_24m,
        },
        {
          label: "Profit margin — first 24 months",
          metric: predictions?.margin_pct_24m,
        },
        {
          label: "ROI — first 24 months",
          metric: predictions?.roi_pct_24m,
        },
      ];

  // ----------------------------------------
  // EMPTY STATE
  // ----------------------------------------

  if (!hasProductResult) {
    return (
      <main className="mx-auto max-w-[1440px] px-6 py-12 lg:px-24">
        <h1 className="text-3xl font-bold text-[#25334A]">
          Product overview
        </h1>

        <p className="mt-4 text-[#61738B]">
          No product evaluation is available.
          Search using Product Details to
          generate an opportunity score.
        </p>

        <Link
          to="/discover"
          className="mt-6 inline-block rounded-lg bg-[#FFD45A] px-6 py-3 font-semibold text-[#25334A]"
        >
          Discover products →
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1440px] px-6 py-5 text-[#0F172A] lg:px-24">
      {/* BREADCRUMB */}
      <div className="text-xs text-[#475569]">
        Discover
        <span className="mx-3">›</span>
        Product overview
      </div>

      {/* PAGE HEADING */}
      <div className="mt-5 flex flex-col justify-between gap-5 md:flex-row md:items-center">
        <div>
          <h1 className="text-[32px] font-bold">
            Product overview
          </h1>

          <p className="mt-2 text-base text-[#475569]">
            Product opportunity analysis.
          </p>

          <p className="mt-2 text-sm font-semibold text-[#193B66]">
            {productName}
          </p>
        </div>

        <Link
          to="/discover"
          className="rounded-lg border border-[#D5DADF] bg-white px-6 py-3 text-sm font-semibold"
        >
          Explore another product
        </Link>
      </div>

      {/* OPPORTUNITY SCORE */}
      <section className="mt-6 overflow-hidden rounded-lg border border-[#D5DADF] bg-white">
        <div className="flex flex-col items-center gap-6 px-6 py-6 md:flex-row">
          <OpportunityGauge
            score={
              hasScore
                ? prediction.opportunity_score
                : null
            }
          />

          <div className="flex-1">
            <h2 className="text-xl font-semibold">
              Opportunity score
            </h2>

            {hasScore && (
              <p className="mt-3 text-sm text-[#475569]">
                Product scoring result:{" "}
                <span className="font-semibold">
                  {prediction.opportunity_score}/100
                </span>
              </p>
            )}

            <ScoreChips reasons={reasons} />

            <p className="mt-3 text-sm leading-6 text-[#61738B]">
              Explore the factors influencing this
              product's opportunity score.
            </p>

            <p className="mt-2 text-xs text-[#61738B]">
              Model factor impacts are not
              opportunity-score points.
            </p>
          </div>

          {hasScore && (
            <button
              type="button"
              onClick={() =>
                setShowExplanations(
                  (previous) => !previous
                )
              }
              aria-expanded={showExplanations}
              aria-controls="score-explanations-panel"
              className="rounded-lg bg-[#FFD45A] px-6 py-3 text-sm font-semibold text-[#25334A]"
            >
              {showExplanations
                ? "Hide explanations ↑"
                : "Explore score factors ↓"}
            </button>
          )}
        </div>

        {/* EXPANDABLE EXPLANATIONS */}
        {hasScore && showExplanations && (
          <div
            id="score-explanations-panel"
            className="border-t border-[#D7E0EB] bg-[#F8FAFC] px-6 py-6"
          >
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <h3 className="text-lg font-semibold text-[#25334A]">
                  Score breakdown
                </h3>

                <p className="mt-2 text-sm text-[#61738B]">
                  Factors identified by the
                  Product Scoring model.
                </p>
              </div>

              <Link
                to="/score-details"
                className="rounded-lg border border-[#D5DADF] bg-white px-5 py-3 text-center text-sm font-semibold text-[#193B66]"
              >
                View detailed explanations →
              </Link>
            </div>

            {loadingReasons && (
              <p
                role="status"
                className="mt-6 rounded-lg bg-white p-5 text-sm text-[#61738B]"
              >
                Loading score factors...
              </p>
            )}

            {reasonsError && !loadingReasons && (
              <div
                role="alert"
                className="mt-6 rounded-lg border border-red-200 bg-red-50 p-5"
              >
                <p className="text-sm text-red-700">
                  {reasonsError}
                </p>

                <button
                  type="button"
                  onClick={retryExplanations}
                  className="mt-3 text-sm font-semibold text-red-700 underline"
                >
                  Retry analysis
                </button>
              </div>
            )}

            {reasons && !loadingReasons && (
              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <div>
                  <h4 className="mb-4 font-semibold text-green-700">
                    Positive factors
                  </h4>

                  <div className="space-y-3">
                    {positiveReasons.length > 0 ? (
                      positiveReasons.map(
                        (reason, index) => (
                          <FactorCard
                            key={`positive-${index}`}
                            reason={reason}
                            positive
                          />
                        )
                      )
                    ) : (
                      <p className="rounded-lg bg-white p-4 text-sm text-[#61738B]">
                        No positive factors returned.
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="mb-4 font-semibold text-red-700">
                    Negative factors
                  </h4>

                  <div className="space-y-3">
                    {negativeReasons.length > 0 ? (
                      negativeReasons.map(
                        (reason, index) => (
                          <FactorCard
                            key={`negative-${index}`}
                            reason={reason}
                            positive={false}
                          />
                        )
                      )
                    ) : (
                      <p className="rounded-lg bg-white p-4 text-sm text-[#61738B]">
                        No negative factors returned.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* PRODUCT INFORMATION */}
      {product && (
        <section className="mt-7 rounded-lg border border-[#D5DADF] bg-white p-6">
          <h2 className="text-xl font-semibold">
            Product information
          </h2>

          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-sm text-[#61738B]">
                Category
              </p>

              <p className="mt-1 font-semibold">
                {product.categoryName ||
                  product.category ||
                  "—"}
              </p>
            </div>

            <div>
              <p className="text-sm text-[#61738B]">
                Selling price
              </p>

              <p className="mt-1 font-semibold">
                {currency(Number(product.price))}
              </p>
            </div>

            <div>
              <p className="text-sm text-[#61738B]">
                Customer reviews
              </p>

              <p className="mt-1 font-semibold">
                {product.reviews ?? "—"}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* PRICE SCENARIO PREVIEW */}
      {hasScore &&
        product &&
        Number.isFinite(Number(product.price)) &&
        Number(product.price) > 0 && (
          <PriceScenarioPreview
            key={JSON.stringify(product)}
            product={product}
          />
        )}

      {/* LEGACY LAUNCH RESULTS, IF AVAILABLE */}
      {predictions && (
        <section className="mt-7">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-xl font-semibold">
                Product launch estimates
              </h2>

              <p className="mt-2 text-sm text-[#61738B]">
                Compare projected launch
                performance over 12 or 24 months.
              </p>
            </div>

            <div
              role="group"
              aria-label="Launch forecast timeframe"
              className="flex gap-2"
            >
              <button
                type="button"
                onClick={() =>
                  setLaunchTimeframe("12m")
                }
                aria-pressed={isTwelveMonths}
                className={`rounded-lg px-5 py-3 text-sm font-semibold ${
                  isTwelveMonths
                    ? "bg-[#FFD45A] text-[#25334A]"
                    : "border border-[#D5DADF] bg-white text-[#25334A]"
                }`}
              >
                12 Months
              </button>

              <button
                type="button"
                onClick={() =>
                  setLaunchTimeframe("24m")
                }
                aria-pressed={!isTwelveMonths}
                className={`rounded-lg px-5 py-3 text-sm font-semibold ${
                  !isTwelveMonths
                    ? "bg-[#FFD45A] text-[#25334A]"
                    : "border border-[#D5DADF] bg-white text-[#25334A]"
                }`}
              >
                24 Months
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {launchMetrics.map(
              ({ label, metric }) => (
                <MetricCard
                  key={label}
                  label={label}
                  metric={metric}
                />
              )
            )}
          </div>

          <p className="mt-4 text-xs leading-5 text-[#61738B]">
            These are previously generated
            estimates from the forecasting model.
          </p>
        </section>
      )}
    </main>
  );
}
