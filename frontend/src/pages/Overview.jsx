
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getPredictionReasons } from "../services/marketlensApi";

import OpportunityGauge from "../components/OpportunityGauge";
import NewIdeaTag from "../components/NewIdeaTag";
import ScoreReasons from "../components/ScoreReasons";
import ScoreSentence from "../components/ScoreSentence";

/**
 * Format numeric values according to the metric's unit.
 */
function formatMetric(metric) {
  if (!metric || !Number.isFinite(Number(metric.value))) {
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

/**
 * Reusable card for forecast metrics.
 */
function MetricCard({ label, metric }) {
  return (
    <div className="min-h-[120px] rounded-lg border border-[#D5DADF] bg-white p-5">
      <p className="text-sm font-semibold text-[#475569]">
        {label}
      </p>

      <p className="mt-3 text-[27px] font-bold text-[#0F172A]">
        {formatMetric(metric)}
      </p>

      {metric?.range && (
        <p className="mt-2 text-xs text-[#61738B]">
          Estimated range:{" "}
          {formatMetric({
            value: metric.range[0],
            unit: metric.unit,
          })}
          {" – "}
          {formatMetric({
            value: metric.range[1],
            unit: metric.unit,
          })}
        </p>
      )}
    </div>
  );
}

/**
 * Overview dashboard.
 *
 * Product scoring and sales forecasting operate independently.
 * This component displays whichever results are available.
 */
export default function Overview({
  product,
  prediction,
  forecast,
}) {
  // Allows users to switch between monthly and yearly forecasts.
  const [timeframe, setTimeframe] = useState("monthly");

  const hasScore =
    prediction?.opportunity_score !== undefined &&
    prediction?.opportunity_score !== null;

  // Reasons are kept with the prediction they explain,
  // so an older result never shows under a newer score.
  const [loadedReasons, setLoadedReasons] = useState(null);

  useEffect(() => {
    if (!hasScore || !product?.title) return;

    let active = true;

    getPredictionReasons(product)
      .then((data) => {
        if (active) setLoadedReasons({ prediction, data });
      })
      .catch(() => {
        // The chips are extra: without them the score still reads fine.
      });

    return () => {
      active = false;
    };
  }, [hasScore, product, prediction]);

  const reasons =
    loadedReasons?.prediction === prediction
      ? loadedReasons.data
      : null;

  const isLaunch = forecast?.type === "launch";
  const isExisting = forecast?.type === "existing";

  // Launch forecasts describe the first 12 or 24 months.
  const launch = isLaunch ? forecast.launch : null;

  // Existing-product forecasts use calendar periods.
  const monthly = isExisting ? forecast.monthly : null;
  const yearly = isExisting ? forecast.yearly : null;

  // Choose the currently displayed forecast.
  const selectedForecast =
    timeframe === "yearly" ? yearly : monthly;

  const predictions = isLaunch
    ? launch?.predictions
    : selectedForecast?.predictions;

  // Forecast endpoints use different metric keys.
  const metrics = isLaunch
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
      ]
    : [
        {
          label: "Units sold",
          metric: predictions?.units_sold,
        },
        {
          label: "Gross revenue",
          metric: predictions?.gross_revenue,
        },
        {
          label: "Net profit",
          metric: predictions?.net_profit,
        },
      ];

  const hasAnyResult =
    hasScore || launch || monthly || yearly;

  // Why no forecast numbers are shown: a skipped forecast,
  // a request that ran and failed, or no search yet.
  const noForecastMessage = forecast?.notCovered
    ? "The sales forecast doesn't cover this category yet, so only the opportunity score is shown."
    : forecast
      ? "The sales forecast request failed, so no forecast is shown for this product or timeframe."
      : "Forecast results are unavailable for the selected product or timeframe.";

  // Identify the currently analyzed product.
  const productName =
    product?.title ||
    monthly?.product_name ||
    yearly?.product_name ||
    launch?.input?.name ||
    null;

  return (
    <main className="mx-auto max-w-[1440px] px-6 py-5 text-[#0F172A] lg:px-24">
      {/* Breadcrumb */}
      <div className="text-xs text-[#475569]">
        Overview
        <span className="mx-3">›</span>
        Product evaluation
      </div>

      {/* Heading */}
      <div className="mt-5 flex flex-col justify-between gap-5 md:flex-row md:items-center">
        <div>
          <h1 className="text-[32px] font-bold">
            Product overview
          </h1>

          <p className="mt-2 text-base text-[#475569]">
            Product opportunity and sales forecasting results.
          </p>

          {productName && (
            <p className="mt-2 text-sm font-semibold text-[#193B66]">
              {productName}
            </p>
          )}
        </div>

        <div className="flex gap-3">
          {/* What-If requires a scored product. */}
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

      {/* Opportunity score */}
      <section className="mt-6 flex flex-col items-center gap-6 rounded-lg border border-[#D5DADF] bg-white px-6 py-5 md:flex-row">
        <OpportunityGauge
          score={
            hasScore ? prediction.opportunity_score : null
          }
        />

        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold">
              Opportunity score
            </h2>

            <NewIdeaTag prediction={prediction} />
          </div>

          {hasScore && (
            <ScoreSentence
              score={prediction.opportunity_score}
              categoryName={product?.categoryName}
            />
          )}

          <ScoreReasons reasons={reasons} />

          {!hasScore && (
            <p className="mt-3 text-sm text-[#61738B]">
              No opportunity score is available for this search.
            </p>
          )}
        </div>

        {hasScore && (
          <Link
            to="/score-details"
            className="rounded-lg bg-[#FFD45A] px-6 py-3 text-sm font-semibold"
          >
            View explanations →
          </Link>
        )}
      </section>

      {/* Forecasting section */}
      <section className="mt-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-semibold">
              Sales forecasting
            </h2>

            <p className="mt-2 text-sm text-[#61738B]">
              {!predictions
                ? "No sales forecast is available."
                : isLaunch
                  ? "Estimated performance during the first 12 months."
                  : "Estimated sales performance for an existing product."}
            </p>
          </div>

          {/* Monthly/yearly selection applies to Product IDs. */}
          {isExisting && (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setTimeframe("monthly")}
                className={`rounded-lg px-5 py-3 text-sm font-semibold ${
                  timeframe === "monthly"
                    ? "bg-[#FFD45A]"
                    : "border border-[#D5DADF] bg-white"
                }`}
              >
                Next month
              </button>

              <button
                type="button"
                onClick={() => setTimeframe("yearly")}
                className={`rounded-lg px-5 py-3 text-sm font-semibold ${
                  timeframe === "yearly"
                    ? "bg-[#FFD45A]"
                    : "border border-[#D5DADF] bg-white"
                }`}
              >
                This year
              </button>
            </div>
          )}
        </div>

        {/* Forecast metrics */}
        {predictions ? (
          <>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {metrics.map(({ label, metric }) => (
                <MetricCard
                  key={label}
                  label={label}
                  metric={metric}
                />
              ))}
            </div>

            {/* Additional forecast information */}
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <MetricCard
                label="Profit margin"
                metric={
                  isLaunch
                    ? predictions.margin_pct_12m
                    : predictions.profit_margin_pct
                }
              />

              <MetricCard
                label="Return on investment"
                metric={
                  isLaunch
                    ? predictions.roi_pct_12m
                    : timeframe === "yearly"
                      ? predictions.roi_year_pct
                      : predictions.roi_unit_pct
                }
              />

              <MetricCard
                label="Average selling price"
                metric={
                  isLaunch
                    ? predictions.avg_price_12m
                    : predictions.avg_price
                }
              />
            </div>
          </>
        ) : (
          <div className="mt-5 rounded-lg border border-[#D5DADF] bg-white p-6 text-sm text-[#61738B]">
            {noForecastMessage}
          </div>
        )}

        {/* Forecast methodology warning */}
        {predictions && (
          <p className="mt-4 text-xs leading-5 text-[#61738B]">
            Forecasts are estimates based partly on simulated
            market data. Displayed ranges reflect typical model
            errors, not guaranteed confidence intervals.
          </p>
        )}
      </section>

      {/* Empty state */}
      {!hasAnyResult && (
        <div className="mt-6 rounded-lg border border-[#D5DADF] bg-white p-6">
          <p className="text-sm text-[#61738B]">
            No product analysis is available yet.
          </p>

          <Link
            to="/discover"
            className="mt-4 inline-block rounded-lg bg-[#FFD45A] px-6 py-3 text-sm font-semibold"
          >
            Analyze a product →
          </Link>
        </div>
      )}
    </main>
  );
}
