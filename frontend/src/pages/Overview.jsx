
import { Link } from "react-router-dom";

import OpportunityGauge from "../components/OpportunityGauge";

// Format API metrics consistently.
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

function MetricCard({ label, metric }) {
  return (
    <div className="min-h-[120px] rounded-lg border border-[#D5DADF] bg-white p-5">
      <p className="text-sm font-semibold text-[#475569]">
        {label}
      </p>

      <p className="mt-3 text-[27px] font-bold text-[#0F172A]">
        {formatMetric(metric)}
      </p>

      {Array.isArray(metric?.range) &&
        metric.range.length === 2 && (
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

export default function Overview({
  product,
  prediction,
  forecast,
}) {
  const hasScore =
    prediction?.opportunity_score !== null &&
    prediction?.opportunity_score !== undefined;

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

  // Product-details analysis only.
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

  const launchMetrics = [
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
      label: "Profit margin",
      metric: predictions?.margin_pct_12m,
    },
    {
      label: "Return on investment",
      metric: predictions?.roi_pct_12m,
    },
    {
      label: "Average selling price",
      metric: predictions?.avg_price_12m,
    },
  ];

  return (
    <main className="mx-auto max-w-[1440px] px-6 py-5 text-[#0F172A] lg:px-24">
      {/* Breadcrumb */}
      <div className="text-xs text-[#475569]">
        Discover
        <span className="mx-3">›</span>
        Product overview
      </div>

      {/* Page heading */}
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

      {/* Opportunity scoring */}
      <section className="mt-6 flex flex-col items-center gap-6 rounded-lg border border-[#D5DADF] bg-white px-6 py-5 md:flex-row">
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
            <p className="mt-3 text-sm text-[#61738B]">
              This score evaluates the product's
              market opportunity using its submitted
              characteristics.
            </p>
          ) : (
            <p className="mt-3 text-sm text-[#61738B]">
              No opportunity score was returned.
              Available launch estimates are shown below.
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

      {/* Product details summary */}
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
                    }).format(Number(product.price))
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

      {/* Launch forecasting */}
      <section className="mt-7">
        <div>
          <h2 className="text-xl font-semibold">
            Product launch estimates
          </h2>

          <p className="mt-2 text-sm text-[#61738B]">
            Estimated performance during the
            first 12 months of a product launch.
          </p>
        </div>

        {predictions ? (
          <>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {launchMetrics.map(({ label, metric }) => (
                <MetricCard
                  key={label}
                  label={label}
                  metric={metric}
                />
              ))}
            </div>

            <p className="mt-4 text-xs leading-5 text-[#61738B]">
              Launch forecasts are based partly on
              simulated market data. Estimated ranges
              reflect typical model errors rather than
              guaranteed confidence intervals.
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
