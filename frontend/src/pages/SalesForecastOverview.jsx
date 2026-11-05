
import { useState } from "react";
import { Link } from "react-router-dom";

// Format numeric forecast values.
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

// Reusable forecasting metric card.
function MetricCard({ label, metric }) {
  const range = metric?.range;

  // Suppress invalid model error ranges.
  const validRange =
    Array.isArray(range) &&
    range.length === 2 &&
    range.every(
      (value) =>
        value !== null &&
        Number.isFinite(Number(value))
    ) &&
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

      {metric && !validRange && range && (
        <p className="mt-2 text-xs text-[#61738B]">
          Estimated range unavailable.
        </p>
      )}
    </div>
  );
}

export default function SalesForecastOverview({
  forecast,
}) {
  const monthly = forecast?.type === "existing"
    ? forecast.monthly
    : null;

  const yearly = forecast?.type === "existing"
    ? forecast.yearly
    : null;

  // Select whichever forecast is available initially.
  const [timeframe, setTimeframe] = useState(
    monthly ? "monthly" : "yearly"
  );

  const hasForecast = Boolean(monthly || yearly);

  const selectedForecast =
    timeframe === "monthly"
      ? monthly
      : yearly;

  const predictions =
    selectedForecast?.predictions;

  const productName =
    monthly?.product_name ||
    yearly?.product_name ||
    "Selected product";

  const productId =
    forecast?.productId ||
    monthly?.product_id ||
    yearly?.product_id;

  const period =
    timeframe === "monthly"
      ? selectedForecast?.month
      : selectedForecast?.year;

  const metrics = [
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
    {
      label: "Profit margin",
      metric: predictions?.profit_margin_pct,
    },
    {
      label:
        timeframe === "yearly"
          ? "Annual return on investment"
          : "Return on investment per unit",
      metric:
        timeframe === "yearly"
          ? predictions?.roi_year_pct
          : predictions?.roi_unit_pct,
    },
    {
      label: "Average selling price",
      metric: predictions?.avg_price,
    },
  ];

  const demandMetrics = [
    {
      label: "Estimated demand",
      metric: predictions?.demand_units,
    },
    {
      label: "Share of category demand",
      metric: predictions?.demand_share_pct,
    },
    {
      label: "Cumulative return on investment",
      metric: predictions?.roi_cum_pct,
    },
  ];

  const monthlyTrend =
    timeframe === "monthly"
      ? selectedForecast?.demand_trend
      : null;

  const yearlyTrend =
    timeframe === "yearly"
      ? selectedForecast?.demand_change_yoy
      : null;

  if (!hasForecast) {
    return (
      <main className="mx-auto max-w-[1440px] px-6 py-12 lg:px-24">
        <h1 className="text-3xl font-bold text-[#25334A]">
          Sales forecasting overview
        </h1>

        <p className="mt-4 text-[#61738B]">
          No existing-product forecast is available.
          Search by Product ID to generate predictions.
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
      {/* Breadcrumb */}
      <div className="text-xs text-[#475569]">
        Discover
        <span className="mx-3">›</span>
        Sales forecasting
      </div>

      {/* Heading */}
      <div className="mt-5 flex flex-col justify-between gap-5 md:flex-row md:items-center">
        <div>
          <h1 className="text-[32px] font-bold">
            Sales forecasting overview
          </h1>

          <p className="mt-2 text-base text-[#475569]">
            Estimated sales and financial performance
            for an existing product.
          </p>

          <p className="mt-3 max-w-4xl break-words text-sm font-semibold text-[#193B66]">
            {productName}
          </p>

          {productId && (
            <p className="mt-2 text-xs text-[#61738B]">
              Product ID: {productId}
            </p>
          )}
        </div>

        <Link
          to="/discover"
          className="rounded-lg border border-[#D5DADF] bg-white px-6 py-3 text-sm font-semibold"
        >
          Explore another product
        </Link>
      </div>

      {/* Forecast period selector */}
      <section className="mt-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-semibold">
              Sales forecast
            </h2>

            <p className="mt-2 text-sm text-[#61738B]">
              {period
                ? `Forecast period: ${period}`
                : "Choose a forecast period."}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!monthly}
              onClick={() => setTimeframe("monthly")}
              aria-pressed={timeframe === "monthly"}
              className={`rounded-lg px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${
                timeframe === "monthly"
                  ? "bg-[#FFD45A]"
                  : "border border-[#D5DADF] bg-white"
              }`}
            >
              Next month
            </button>

            <button
              type="button"
              disabled={!yearly}
              onClick={() => setTimeframe("yearly")}
              aria-pressed={timeframe === "yearly"}
              className={`rounded-lg px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${
                timeframe === "yearly"
                  ? "bg-[#FFD45A]"
                  : "border border-[#D5DADF] bg-white"
              }`}
            >
              This year
            </button>
          </div>
        </div>

        {/* Financial metrics */}
        {predictions ? (
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {metrics.map(({ label, metric }) => (
              <MetricCard
                key={label}
                label={label}
                metric={metric}
              />
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-lg border border-[#D5DADF] bg-white p-6">
            <p className="text-sm text-[#61738B]">
              Forecast data is not available for
              the selected period.
            </p>
          </div>
        )}
      </section>

      {/* Additional demand insights */}
      {predictions && (
        <section className="mt-8">
          <h2 className="text-xl font-semibold">
            Demand and performance insights
          </h2>

          <p className="mt-2 text-sm text-[#61738B]">
            Additional outputs from the sales
            forecasting model.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {demandMetrics.map(({ label, metric }) => (
              <MetricCard
                key={label}
                label={label}
                metric={metric}
              />
            ))}
          </div>
        </section>
      )}

      {/* Demand trend */}
      {(monthlyTrend || yearlyTrend) && (
        <section className="mt-8 rounded-lg border border-[#D5DADF] bg-white p-6">
          <h2 className="text-xl font-semibold">
            Demand trend
          </h2>

          {monthlyTrend && (
            <>
              <p className="mt-4 text-sm text-[#61738B]">
                Expected direction compared with
                the previous month's demand.
              </p>

              <p className="mt-3 text-2xl font-bold capitalize text-[#193B66]">
                {monthlyTrend.direction || "Unavailable"}
              </p>

              <p className="mt-3 text-sm text-[#61738B]">
                Previous month demand:{" "}
                {monthlyTrend.last_month_demand ??
                  "Unavailable"}{" "}
                units
              </p>
            </>
          )}

          {yearlyTrend && (
            <>
              <p className="mt-4 text-sm text-[#61738B]">
                Estimated change in demand compared
                with the previous year.
              </p>

              <p className="mt-3 text-2xl font-bold capitalize text-[#193B66]">
                {yearlyTrend.direction || "Unavailable"}
              </p>

              {yearlyTrend.value !== null &&
                yearlyTrend.value !== undefined && (
                  <p className="mt-3 text-sm text-[#61738B]">
                    Year-over-year demand change:{" "}
                    {yearlyTrend.value}%
                  </p>
                )}

              <p className="mt-2 text-sm text-[#61738B]">
                Previous year demand:{" "}
                {yearlyTrend.last_year_demand ??
                  "Unavailable"}{" "}
                units
              </p>
            </>
          )}
        </section>
      )}

      {/* Forecast assumptions */}
      {selectedForecast && (
        <section className="mt-8 rounded-lg border border-[#D5DADF] bg-white p-6">
          <h2 className="text-xl font-semibold">
            Forecast information
          </h2>

          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <div>
              <p className="text-sm text-[#61738B]">
                Forecast type
              </p>
              <p className="mt-1 font-semibold">
                {timeframe === "monthly"
                  ? "Monthly"
                  : "Yearly"}
              </p>
            </div>

            <div>
              <p className="text-sm text-[#61738B]">
                Forecast period
              </p>
              <p className="mt-1 font-semibold">
                {period ?? "—"}
              </p>
            </div>

            {timeframe === "monthly" && (
              <>
                <div>
                  <p className="text-sm text-[#61738B]">
                    Expected promotion discount
                  </p>
                  <p className="mt-1 font-semibold">
                    {selectedForecast.promo_depth_pct ??
                      "—"}
                    {selectedForecast.promo_depth_pct !=
                    null
                      ? "%"
                      : ""}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-[#61738B]">
                    Promotion assumption
                  </p>
                  <p className="mt-1 font-semibold">
                    {selectedForecast.promo_source || "—"}
                  </p>
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {/* Model notes */}
      <section className="mt-8 rounded-lg border border-[#D5DADF] bg-white p-6">
        <h2 className="text-xl font-semibold">
          Methodology and limitations
        </h2>

        <p className="mt-3 text-sm leading-6 text-[#61738B]">
          MarketLens forecasts are model-generated
          estimates based partly on simulated
          market and financial data. Prediction
          ranges describe typical model errors
          and are not guaranteed confidence
          intervals.
        </p>

        {selectedForecast?.notes?.length > 0 && (
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-[#61738B]">
            {selectedForecast.notes.map((note, index) => (
              <li key={index}>{note}</li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
