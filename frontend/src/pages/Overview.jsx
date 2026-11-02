
import { Link } from "react-router-dom";
import OpportunityGauge from "../components/OpportunityGauge";

export default function Overview({ product, prediction }) {
  const hasPrediction = prediction !== null;

  const score = hasPrediction
    ? prediction.opportunity_score
    : null;

  const monthlyMetrics = [
    { label: "Units sold", value: "—" },
    { label: "Gross revenue", value: "$—" },
    { label: "Net profit", value: "$—" },
  ];

  return (
    <main className="mx-auto max-w-[1440px] px-6 py-5 text-[#0F172A] lg:px-24">
      {/* Breadcrumb */}
      <div className="text-xs text-[#475569]">
        Overview
        <span className="mx-3">›</span>
        <span className="text-[#0F172A]">
          Product evaluation
        </span>
      </div>

      {/* Page heading */}
      <div className="mt-5 flex flex-col justify-between gap-5 md:flex-row md:items-center">
        <div>
          <h1 className="text-[32px] font-bold leading-10">
            Product overview
          </h1>

          <p className="mt-2 text-base text-[#475569]">
            Opportunity Score and key monthly projections.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled
            title="Save Product will be implemented later"
            className="h-11 rounded-lg bg-[#EDF3FA] px-6 text-sm font-semibold text-[#193B66] disabled:cursor-not-allowed disabled:opacity-60"
          >
            ☆ Save product
          </button>

          <Link
            to="/launch-feasibility"
            className="flex h-11 min-w-40 items-center justify-center rounded-lg bg-[#193B66] px-6 text-sm font-semibold text-white hover:bg-[#122E52]"
          >
            What-If →
          </Link>
        </div>
      </div>

      {/* Opportunity score card */}
      <section className="mt-5 flex flex-col items-center gap-6 rounded-lg border border-[#D5DADF] bg-white px-6 py-5 md:flex-row">
        <OpportunityGauge score={score} />

        <div className="flex-1">
          <h2 className="text-xl font-semibold">
            Opportunity score
          </h2>

          <p className="mt-2 text-base text-[#475569]">
            Category-relative product ranking.
          </p>

          <p className="mt-2 text-sm text-[#475569]">
            Model target: top 20% of monthly category sales.
          </p>

          {product?.title && (
            <p className="mt-3 text-sm font-medium text-[#193B66]">
              {product.title}
            </p>
          )}
        </div>

        <Link
          to={hasPrediction ? "/score-details" : "/discover"}
          className="flex h-11 w-full items-center justify-center rounded-lg border border-[#E9BC3E] bg-[#FFD45A] px-6 text-sm font-semibold text-[#0F172A] hover:bg-[#F5C842] md:w-[234px]"
        >
          {hasPrediction
            ? "View explanations →"
            : "Score a product →"}
        </Link>
      </section>

      {/* Monthly projections */}
      <section className="mt-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <h2 className="text-xl font-semibold">
            Monthly projections
          </h2>

          <div className="flex gap-3">
            <button
              type="button"
              className="h-11 min-w-36 rounded-lg border border-[#E9BC3E] bg-[#FFD45A] px-5 text-sm font-semibold"
            >
              Next month
            </button>

            <button
              type="button"
              disabled
              title="Yearly projections are not yet available"
              className="h-11 min-w-36 rounded-lg border border-[#D5DADF] bg-white px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              This year
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {monthlyMetrics.map((metric) => (
            <div
              key={metric.label}
              className="min-h-[112px] rounded-lg border border-[#D5DADF] bg-white p-4"
            >
              <p className="text-sm font-semibold text-[#475569]">
                {metric.label}
              </p>

              <p className="mt-3 text-[27px] font-bold text-[#0F172A]">
                {metric.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Detailed report */}
      <section className="mt-4 flex flex-col justify-between gap-5 rounded-lg border border-[#D5DADF] bg-white p-6 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold">
            Detailed monthly report
          </h2>

          <p className="mt-3 text-base text-[#475569]">
            Detailed monthly metrics will appear when
            the forecasting backend is available.
          </p>
        </div>

        <button
          type="button"
          disabled
          title="Detailed monthly report is not yet available"
          className="h-11 rounded-lg border border-[#E9BC3E] bg-[#FFD45A] px-6 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
        >
          View detailed report →
        </button>
      </section>

      {/* Explore another product */}
      <Link
        to="/discover"
        className="mt-4 inline-flex h-11 items-center justify-center rounded-lg border border-[#D5DADF] bg-white px-8 text-sm font-semibold text-[#0F172A] hover:bg-slate-50"
      >
        ↺ Explore another product
      </Link>

      {!hasPrediction && (
        <p className="mt-5 text-sm text-[#475569]">
          No product has been scored yet. Start in Discover
          to generate an opportunity score.
        </p>
      )}
    </main>
  );
}
