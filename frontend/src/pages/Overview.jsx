
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import OpportunityGauge from "../components/OpportunityGauge";
import { getPredictionReasons } from "../services/marketlensApi";

// ----------------------------------------
// FORMATTING HELPERS
// ----------------------------------------

function formatMetric(metric) {
  if (
    !metric ||
    metric.value === null ||
    metric.value === undefined ||
    !Number.isFinite(Number(metric.value))
  ) {
    return "—";
  }

  const value = Number(metric.value);

  if (metric.unit === "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(value);
  }

  if (metric.unit === "%") {
    return `${value.toFixed(2)}%`;
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
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
        value !== null &&
        Number.isFinite(Number(value))
    ) &&
    Number(range[0]) <= Number(range[1]) &&
    metric?.value != null &&
    Number(range[0]) <= Number(metric.value) &&
    Number(metric.value) <= Number(range[1]);

  return (
    <div className="min-h-[120px] rounded-lg border border-[#D5DADF] bg-white p-5 transition-shadow hover:shadow-md">
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

      {metric?.range && !validRange && (
        <p className="mt-2 text-xs text-[#61738B]">
          Estimated range unavailable.
        </p>
      )}
    </div>
  );
}

// ----------------------------------------
// SCORE FACTOR CARD
// ----------------------------------------

function FactorCard({ reason, positive }) {
  const impact = Number(reason.impact);
  const validImpact = Number.isFinite(impact);

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
// PRODUCT OVERVIEW
// ----------------------------------------

export default function Overview({
  product,
  prediction,
  forecast,
}) {
  // ----------------------------------------
  // OPPORTUNITY SCORING STATE
  // ----------------------------------------

  const hasScore =
    prediction?.opportunity_score !== null &&
    prediction?.opportunity_score !== undefined;

  const [showExplanations, setShowExplanations] =
    useState(false);

  const [loadedReasons, setLoadedReasons] =
    useState(null);

  const [loadingReasons, setLoadingReasons] =
    useState(false);

  const [reasonsError, setReasonsError] =
    useState("");

  const [retryCount, setRetryCount] = useState(0);

  // ----------------------------------------
  // LAUNCH FORECAST STATE
  // ----------------------------------------

  // NEW: User-selected forecast timeframe.
  const [launchTimeframe, setLaunchTimeframe] =
    useState("12m");

  const launch =
    forecast?.type === "launch"
      ? forecast.launch
      : null;

  const predictions = launch?.predictions;

  const hasProductResult =
    hasScore || Boolean(launch);

  const productName =
    product?.title ||
    launch?.input?.name ||
    "Selected product";

  // ----------------------------------------
  // SCORE EXPLANATIONS
  // ----------------------------------------

  const reasons =
    loadedReasons?.product === product &&
    loadedReasons?.prediction === prediction
      ? loadedReasons.data
      : null;

  useEffect(() => {
    if (
      !showExplanations ||
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
    showExplanations,
    hasScore,
    product,
    prediction,
    reasons,
    reasonsError,
    retryCount,
  ]);

  function toggleExplanations() {
    setShowExplanations((previous) => !previous);
  }

  function retryExplanations() {
    setReasonsError("");
    setRetryCount((previous) => previous + 1);
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

  // ----------------------------------------
  // NEW: DYNAMIC LAUNCH FORECAST METRICS
  // ----------------------------------------

  const isTwelveMonths =
    launchTimeframe === "12m";

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
          Search using Product Details to generate
          an opportunity score.
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

  // ----------------------------------------
  // MAIN PAGE
  // ----------------------------------------

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
            Product opportunity analysis and
            launch estimates.
          </p>

          <p className="mt-2 text-sm font-semibold text-[#193B66]">
            {productName}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {hasScore && (
            <Link
              to="/launch-feasibility"
              className="rounded-lg bg-[#193B66] px-6 py-3 text-sm font-semibold text-white"
            >
              What-If →
            </Link>
          )}

          <Link
            to="/discover"
            className="rounded-lg border border-[#D5DADF] bg-white px-6 py-3 text-sm font-semibold"
          >
            Explore another product
          </Link>
        </div>
      </div>

      {/* INTERACTIVE OPPORTUNITY SCORE */}
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
              Product opportunity score
            </h2>

            <p className="mt-2 text-sm text-[#475569]">
              Generated by the Product Scoring API.
            </p>

            {hasScore ? (
              <>
                <p className="mt-3 text-sm leading-6 text-[#61738B]">
                  Explore the factors influencing
                  this product's opportunity score.
                  Expand the analysis to see positive
                  and negative model factors.
                </p>

                <p className="mt-2 text-xs text-[#61738B]">
                  Model factor impacts are not
                  opportunity-score points.
                </p>
              </>
            ) : (
              <p className="mt-3 text-sm text-[#61738B]">
                No opportunity score was returned.
                Available launch estimates are
                shown below.
              </p>
            )}
          </div>

          {hasScore && (
            <button
              type="button"
              onClick={toggleExplanations}
              aria-expanded={showExplanations}
              aria-controls="score-explanations-panel"
              className="rounded-lg bg-[#FFD45A] px-6 py-3 text-sm font-semibold text-[#25334A] transition hover:bg-[#F5C842]"
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
                  Factors identified by the product
                  opportunity model.
                </p>
              </div>

              <Link
                to="/score-details"
                className="rounded-lg border border-[#D5DADF] bg-white px-5 py-3 text-center text-sm font-semibold text-[#193B66] hover:bg-[#EEF2F6]"
              >
                View detailed explanations →
              </Link>
            </div>

            {/* LOADING */}
            {loadingReasons && (
              <div
                role="status"
                className="mt-6 rounded-lg border border-[#D7E0EB] bg-white p-5"
              >
                <p className="text-sm text-[#61738B]">
                  Analyzing factors influencing
                  this product...
                </p>
              </div>
            )}

            {/* ERROR */}
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

            {/* POSITIVE AND NEGATIVE FACTORS */}
            {reasons && !loadingReasons && (
              <div className="mt-6 grid gap-6 md:grid-cols-2">
                {/* POSITIVE FACTORS */}
                <div>
                  <div className="mb-4 flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 font-bold text-green-700">
                      +
                    </span>

                    <div>
                      <h4 className="font-semibold text-[#25334A]">
                        Positive factors
                      </h4>

                      <p className="text-xs text-[#61738B]">
                        Factors supporting the score
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {positiveReasons.length > 0 ? (
                      positiveReasons.map(
                        (reason, index) => (
                          <FactorCard
                            key={`positive-${reason.feature}-${index}`}
                            reason={reason}
                            positive
                          />
                        )
                      )
                    ) : (
                      <p className="rounded-lg border border-[#D7E0EB] bg-white p-4 text-sm text-[#61738B]">
                        No positive factors returned.
                      </p>
                    )}
                  </div>
                </div>

                {/* NEGATIVE FACTORS */}
                <div>
                  <div className="mb-4 flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100 font-bold text-red-700">
                      −
                    </span>

                    <div>
                      <h4 className="font-semibold text-[#25334A]">
                        Negative factors
                      </h4>

                      <p className="text-xs text-[#61738B]">
                        Factors reducing the score
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {negativeReasons.length > 0 ? (
                      negativeReasons.map(
                        (reason, index) => (
                          <FactorCard
                            key={`negative-${reason.feature}-${index}`}
                            reason={reason}
                            positive={false}
                          />
                        )
                      )
                    ) : (
                      <p className="rounded-lg border border-[#D7E0EB] bg-white p-4 text-sm text-[#61738B]">
                        No negative factors returned.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {reasons && (
              <p className="mt-5 text-xs leading-5 text-[#61738B]">
                Model explanation impacts are not
                direct percentage changes or
                guaranteed causal effects.
              </p>
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
                {Number.isFinite(
                  Number(product.price)
                )
                  ? new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                    }).format(
                      Number(product.price)
                    )
                  : "—"}
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

      {/* ----------------------------------------
          INTERACTIVE LAUNCH FORECAST
          ---------------------------------------- */}
      <section className="mt-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-semibold">
              Product launch estimates
            </h2>

            <p className="mt-2 text-sm text-[#61738B]">
              Compare projected launch performance
              over the first 12 or 24 months.
            </p>
          </div>

          {/* NEW: TIMEFRAME SELECTOR */}
          {predictions && (
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
                className={`rounded-lg px-5 py-3 text-sm font-semibold transition ${
                  isTwelveMonths
                    ? "bg-[#FFD45A] text-[#25334A]"
                    : "border border-[#D5DADF] bg-white text-[#25334A] hover:bg-[#F3F6FA]"
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
                className={`rounded-lg px-5 py-3 text-sm font-semibold transition ${
                  !isTwelveMonths
                    ? "bg-[#FFD45A] text-[#25334A]"
                    : "border border-[#D5DADF] bg-white text-[#25334A] hover:bg-[#F3F6FA]"
                }`}
              >
                24 Months
              </button>
            </div>
          )}
        </div>

        {predictions ? (
          <>
            {/* DYNAMIC METRICS */}
            <div
              key={launchTimeframe}
              className="mt-5 grid gap-4 md:grid-cols-3"
            >
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

            {/* CURRENT TIMEFRAME NOTE */}
            <div className="mt-5 rounded-lg border border-[#D7E0EB] bg-white px-5 py-4">
              <p className="text-sm font-semibold text-[#25334A]">
                {isTwelveMonths
                  ? "First-year launch forecast"
                  : "Two-year launch forecast"}
              </p>

              <p className="mt-2 text-sm leading-6 text-[#61738B]">
                {isTwelveMonths
                  ? "These estimates cover the first 12 months after launch."
                  : "These are cumulative estimates covering the first 24 months after launch, not just the second year."}
              </p>
            </div>

            {/* FORECAST DISCLAIMER */}
            <p className="mt-4 text-xs leading-5 text-[#61738B]">
              Launch forecasts are based partly on
              simulated market data. Estimated ranges
              reflect typical model errors rather
              than guaranteed confidence intervals.
              Switching timeframes displays different
              model outputs without retraining or
              submitting another prediction request.
            </p>
          </>
        ) : (
          <div className="mt-5 rounded-lg border border-[#D5DADF] bg-white p-6">
            <p className="text-sm text-[#61738B]">
              {forecast?.notCovered
                ? "Launch forecasting is not supported for this product category."
                : "Launch estimates are currently unavailable for this product."}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
