
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getPredictionReasons } from "../services/marketlensApi";
import { getScoreBand } from "../constants/scoreBands";
import NewIdeaTag from "../components/NewIdeaTag";
import ScoreSentence from "../components/ScoreSentence";
import { factorKey, factorName } from "../constants/scoreFactors";

// ============================================================
// MARKETLENS — OPPORTUNITY SCORE DETAILS
// Strengths & Watchouts experience
// ============================================================

// Friendly explanations for known scoring factors, keyed by the API's
// factor label (see constants/scoreFactors.js). These are educational
// interpretations, not causal claims.

const FEATURE_DETAILS = {
  "title length": {
    description:
      "The length of your product title is one of the signals considered by the scoring model.",
    recommendation:
      "Keep your title descriptive, concise, and easy for shoppers to understand.",
  },

  "brand size": {
    description:
      "This factor represents the brand's relative presence in the product data used by the model.",
    recommendation:
      "Research competing brands and consider what would make your product different.",
  },

  "title capitals": {
    description:
      "The model considers capitalization patterns in product titles.",
    recommendation:
      "Use consistent capitalization and avoid unnecessary all-caps wording.",
  },

  "title wording": {
    description:
      "The model considers patterns in product title wording. This factor does not identify which individual words are responsible for the score.",
    recommendation:
      "Review your title for accuracy, readability, and relevance to your intended customers.",
  },

  "title meaning": {
    description:
      "This factor captures a statistical pattern in the meaning of your product title. It cannot be interpreted as a specific keyword problem.",
    recommendation:
      "Make sure your title accurately describes the product and its important features.",
  },

  "brand track record in category": {
    description:
      "This factor represents a pattern associated with how the brand performs in this product category.",
    recommendation:
      "Study established competitors and look for customer needs that may be underserved.",
  },

  "brand track record": {
    description:
      "This factor represents a pattern associated with how the brand performs across all of its product categories.",
    recommendation:
      "Look at how established brands earn shopper trust and what they offer that you could match or improve on.",
  },
};

// ============================================================
// HELPERS
// ============================================================

function normalizeReasons(data) {
  const normalizeGroup = (items) => {
    if (!Array.isArray(items)) return [];

    return items
      .map((item, index) => {
        const impact = Number(item?.impact);

        if (!Number.isFinite(impact)) {
          return null;
        }

        const feature =
          item?.feature ||
          `factor_${index + 1}`;

        const known = FEATURE_DETAILS[factorKey(item)];

        return {
          id: `${feature}-${index}`,
          feature,
          label: factorName(item),
          impact,
          description: known?.description || null,
          recommendation:
            known?.recommendation || null,
        };
      })
      .filter(Boolean)
      .sort(
        (a, b) =>
          Math.abs(b.impact) -
          Math.abs(a.impact)
      );
  };

  return {
    positive: normalizeGroup(data?.reasons_up),
    negative: normalizeGroup(data?.reasons_down),
  };
}

function getRelativeImpact(value, maxImpact) {
  if (!maxImpact) return 0;

  return Math.min(
    100,
    (Math.abs(value) / maxImpact) * 100
  );
}

function getImpactLabel(percentage) {
  if (percentage >= 70) return "Larger";
  if (percentage >= 35) return "Moderate";
  return "Smaller";
}

// ============================================================
// ANIMATED SCORE GAUGE
// ============================================================

function AnimatedScoreGauge({ score }) {
  const [animatedScore, setAnimatedScore] =
    useState(0);

  const scoreInfo = getScoreBand(score);

  const radius = 69;
  const circumference = 2 * Math.PI * radius;

  const boundedScore = Math.max(
    0,
    Math.min(100, Number(score) || 0)
  );

  // animatedScore starts at 0, so the first frame animates the ring
  // from empty to the score.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setAnimatedScore(boundedScore);
    });

    return () => cancelAnimationFrame(frame);
  }, [boundedScore]);

  const offset =
    circumference *
    (1 - animatedScore / 100);

  return (
    <div
      className="relative mx-auto h-48 w-48 shrink-0 sm:h-52 sm:w-52"
      role="img"
      aria-label={`Opportunity score: ${boundedScore} out of 100. ${scoreInfo.label}`}
    >
      <svg
        viewBox="0 0 200 200"
        className="h-full w-full -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="none"
          stroke="#E2E8F0"
          strokeWidth="13"
        />

        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="none"
          stroke={scoreInfo.color}
          strokeWidth="13"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition:
              "stroke-dashoffset 1.3s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="flex items-baseline">
          <span
            className="text-5xl font-extrabold tracking-tight"
            style={{ color: scoreInfo.color }}
          >
            {Math.round(boundedScore)}
          </span>

          <span className="ml-1 text-sm text-slate-500">
            /100
          </span>
        </div>

        <span
          className="mt-2 text-sm font-semibold"
          style={{ color: scoreInfo.color }}
        >
          {scoreInfo.label}
        </span>
      </div>
    </div>
  );
}

// ============================================================
// FACTOR CARD
// ============================================================

function FactorCard({
  factor,
  positive,
  maxImpact,
  index,
}) {
  const [expanded, setExpanded] = useState(false);

  const relativeImpact = getRelativeImpact(
    factor.impact,
    maxImpact
  );

  const label = getImpactLabel(relativeImpact);

  const colorClasses = positive
    ? {
        bar: "bg-emerald-500",
        text: "text-emerald-700",
        badge: "bg-emerald-50 text-emerald-700",
        panel: "bg-emerald-50/40",
      }
    : {
        bar: "bg-rose-500",
        text: "text-rose-700",
        badge: "bg-rose-50 text-rose-700",
        panel: "bg-rose-50/40",
      };

  const detailId = `${
    positive ? "strength" : "watchout"
  }-${index}-details`;

  return (
    <article className="group overflow-hidden rounded-2xl border border-[#D7E0EB] bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      <button
        type="button"
        onClick={() =>
          setExpanded((previous) => !previous)
        }
        aria-expanded={expanded}
        aria-controls={detailId}
        className="w-full p-5 text-left focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#193B66]"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-[#25334A]">
              {factor.label}
            </h3>

            <p className="mt-1 text-xs text-[#61738B]">
              {label} relative impact
            </p>
          </div>

          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${colorClasses.badge}`}
          >
            {positive ? "Strength" : "Watchout"}
          </span>
        </div>

        {/* Contribution visualization */}
        <div className="mt-5">
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all duration-700 ${colorClasses.bar}`}
              style={{
                width: `${relativeImpact}%`,
              }}
            />
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs text-[#61738B]">
              Model contribution
            </span>

            <span
              className={`font-mono text-sm font-bold ${colorClasses.text}`}
            >
              {factor.impact > 0 ? "+" : ""}
              {factor.impact.toFixed(3)}
            </span>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-[#193B66]">
          <span>
            {expanded
              ? "Hide explanation"
              : "Understand this factor"}
          </span>

          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`h-4 w-4 transition-transform duration-300 ${
              expanded ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
      </button>

      {/* Expandable insight */}
      {expanded && (
        <div
          id={detailId}
          className={`border-t border-[#E2E8F0] px-5 py-5 ${colorClasses.panel}`}
        >
          <h4 className="text-sm font-bold text-[#25334A]">
            What does this mean?
          </h4>

          <p className="mt-2 text-sm leading-6 text-[#475569]">
            {factor.description ||
              "This factor influenced the model's result. A more specific business interpretation has not been verified."}
          </p>

          {factor.recommendation && (
            <div className="mt-4 rounded-xl border border-[#D7E0EB] bg-white p-4">
              <div className="flex items-start gap-3">
                <span
                  className="text-lg text-amber-600"
                  aria-hidden="true"
                >
                  ✦
                </span>

                <div>
                  <p className="text-sm font-semibold text-[#25334A]">
                    Suggested action
                  </p>

                  <p className="mt-1 text-sm leading-6 text-[#475569]">
                    {factor.recommendation}
                  </p>
                </div>
              </div>
            </div>
          )}

          <p className="mt-4 text-xs text-[#64748B]">
            Model feature: {factor.feature}
          </p>

          <p className="mt-1 text-xs leading-5 text-[#64748B]">
            Contribution values are model explanation
            units, not opportunity-score points or
            percentage changes.
          </p>
        </div>
      )}
    </article>
  );
}

// ============================================================
// STRENGTHS / WATCHOUTS SECTION
// ============================================================

function FactorSection({
  title,
  subtitle,
  factors,
  positive,
  maxImpact,
}) {
  return (
    <section className="min-w-0">
      <div className="mb-5 flex items-start gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
            positive
              ? "bg-emerald-100 text-emerald-700"
              : "bg-rose-100 text-rose-700"
          }`}
        >
          {positive ? (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-6 w-6"
              aria-hidden="true"
            >
              <path d="m3 17 6-6 4 4 8-8" />
              <path d="M15 7h6v6" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-6 w-6"
              aria-hidden="true"
            >
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
              <path d="M10.3 3.8 2.1 18a2 2 0 0 0 1.7 3h16.4a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z" />
            </svg>
          )}
        </div>

        <div>
          <h2 className="text-xl font-bold text-[#25334A]">
            {title}
          </h2>

          <p className="mt-1 text-sm text-[#61738B]">
            {subtitle}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {factors.length > 0 ? (
          factors.map((factor, index) => (
            <FactorCard
              key={factor.id}
              factor={factor}
              positive={positive}
              maxImpact={maxImpact}
              index={index}
            />
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-white p-6">
            <p className="text-sm text-[#61738B]">
              No factors were returned for this section.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

// ============================================================
// NEXT STEPS
// ============================================================

function NextSteps({ negativeFactors }) {
  const recommendations = [
    ...new Set(
      negativeFactors
        .map((factor) => factor.recommendation)
        .filter(Boolean)
    ),
  ].slice(0, 3);

  const fallback = [
    "Compare similar products to better understand competition.",
    "Research customer needs and identify opportunities to differentiate.",
    "Review demand, costs, and profitability before making a launch decision.",
  ];

  const steps =
    recommendations.length > 0
      ? recommendations
      : fallback;

  return (
    <section className="mt-10 overflow-hidden rounded-3xl border border-[#D7E0EB] bg-white p-6 shadow-sm sm:p-8">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-6 w-6"
            aria-hidden="true"
          >
            <path d="M9 18h6" />
            <path d="M10 22h4" />
            <path d="M15 14.5a7 7 0 1 0-6 0V18h6v-3.5Z" />
          </svg>
        </div>

        <div>
          <h2 className="text-xl font-bold text-[#25334A]">
            Suggested next steps
          </h2>

          <p className="mt-2 text-sm leading-6 text-[#61738B]">
            Use these ideas to guide your research.
            They are not guaranteed ways to increase
            the score.
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {steps.map((step, index) => (
          <div
            key={`${index}-${step}`}
            className="flex items-start gap-4 rounded-xl bg-[#F8FAFC] p-4"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="m5 12 4 4L19 6" />
              </svg>
            </div>

            <p className="text-sm leading-6 text-[#25334A]">
              {step}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================

export default function ScoreDetails({
  product,
  prediction,
}) {
  const navigate = useNavigate();

  const [reasons, setReasons] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const score =
    prediction?.opportunity_score == null
      ? null
      : Number(prediction.opportunity_score);

  const hasScore =
    score !== null && Number.isFinite(score);

  const productTitle = product?.title;

  // ==========================================================
  // FETCH REAL SCORING EXPLANATIONS
  // ==========================================================

  useEffect(() => {
    if (!hasScore || !productTitle) {
      return;
    }

    let active = true;

    async function loadReasons() {
      setLoading(true);
      setError(false);
      setReasons(null);

      try {
        // Same existing backend integration as the
        // original MarketLens Score Details page.
        const response =
          await getPredictionReasons(product);

        if (active) {
          setReasons(normalizeReasons(response));
        }
      } catch (err) {
        console.error(
          "Unable to retrieve scoring explanations:",
          err
        );

        if (active) {
          setError(true);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadReasons();

    return () => {
      active = false;
    };
  }, [
    product,
    productTitle,
    hasScore,
    retryCount,
  ]);

  // ==========================================================
  // NO SCORING RESULT
  // ==========================================================

  if (!hasScore || !product) {
    return (
      <main className="mx-auto flex min-h-[65vh] max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-8 w-8"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 7v6" />
            <path d="M12 17h.01" />
          </svg>
        </div>

        <h1 className="mt-6 text-2xl font-bold text-[#25334A]">
          No opportunity analysis selected
        </h1>

        <p className="mt-3 max-w-md text-sm leading-7 text-[#61738B]">
          Analyze a product first to explore its
          opportunity score, strengths, and watchouts.
        </p>

        <button
          type="button"
          onClick={() => navigate("/discover")}
          className="mt-7 rounded-xl bg-[#FFD45A] px-6 py-3 text-sm font-semibold text-[#25334A] transition-colors hover:bg-[#F5C842]"
        >
          Discover products
        </button>
      </main>
    );
  }

  const positiveFactors = reasons?.positive || [];
  const negativeFactors = reasons?.negative || [];

  const allFactors = [
    ...positiveFactors,
    ...negativeFactors,
  ];

  const maxImpact = Math.max(
    0,
    ...allFactors.map((factor) =>
      Math.abs(factor.impact)
    )
  );

  const scoreInfo = getScoreBand(score);

  // ==========================================================
  // PAGE CONTENT
  // ==========================================================

  return (
    <main className="mx-auto w-full max-w-[1440px] px-5 pb-20 pt-8 text-[#25334A] sm:px-8 lg:px-24">
      {/* BREADCRUMB */}

      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-2 text-xs text-[#61738B]"
      >
        <button
          type="button"
          onClick={() => navigate("/product-overview")}
          className="transition-colors hover:text-[#193B66]"
        >
          Product overview
        </button>

        <span aria-hidden="true">›</span>

        <span>Score explanations</span>
      </nav>

      {/* PAGE HEADING */}

      <header className="mt-7">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#D7E0EB] bg-white px-4 py-2">
          <span
            className="h-2 w-2 rounded-full bg-[#E6AC24]"
            aria-hidden="true"
          />

          <span className="text-xs font-semibold uppercase tracking-wider text-[#61738B]">
            Product opportunity analysis
          </span>
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight text-[#0F172A] sm:text-4xl">
          Understand your product opportunity
        </h1>

        <p className="mt-4 max-w-2xl text-base leading-7 text-[#61738B]">
          Discover what's working, what needs
          attention, and where to focus your
          research before launching.
        </p>
      </header>

      {/* MAIN SCORE CARD */}

      <section className="relative mt-8 overflow-hidden rounded-3xl border border-[#D7E0EB] bg-white p-6 shadow-sm sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-amber-50 opacity-70 blur-3xl"
        />

        <div className="relative grid items-center gap-8 md:grid-cols-[1fr_auto]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#61738B]">
              {product?.categoryName ||
                "Selected product"}
            </p>

            <h2 className="mt-3 text-2xl font-bold text-[#0F172A]">
              {productTitle}
            </h2>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold"
                style={{
                  color: scoreInfo.color,
                  backgroundColor: `${scoreInfo.color}14`,
                }}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor:
                      scoreInfo.color,
                  }}
                />

                {scoreInfo.label} opportunity
              </span>

              <NewIdeaTag prediction={prediction} />
            </div>

            <div className="mt-7">
              <h3 className="text-base font-bold text-[#25334A]">
                What this means
              </h3>

              <div className="mt-3">
                <ScoreSentence
                  score={score}
                  categoryName={
                    product?.categoryName
                  }
                />
              </div>
            </div>
          </div>

          <AnimatedScoreGauge score={score} />
        </div>

        {/* SCORE DISCLAIMER */}

        <div className="relative mt-8 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
          <div className="flex items-start gap-3">
            <span
              className="mt-0.5 font-bold text-[#193B66]"
              aria-hidden="true"
            >
              ⓘ
            </span>

            <p className="text-sm leading-6 text-[#61738B]">
              This opportunity score helps you
              compare product ideas. It does not
              guarantee sales, profitability, or
              a successful launch.
            </p>
          </div>
        </div>
      </section>

      {/* BREAKDOWN HEADER */}

      <div className="mt-11">
        <h2 className="text-2xl font-bold text-[#0F172A]">
          Strengths & Watchouts
        </h2>

        <p className="mt-2 text-sm leading-6 text-[#61738B]">
          Explore the factors influencing your
          product's opportunity score. Select
          a card to learn more.
        </p>
      </div>

      {/* LOADING STATE */}

      {loading && (
        <div
          role="status"
          className="mt-6 rounded-2xl border border-[#D7E0EB] bg-white p-8"
        >
          <div className="flex items-center gap-4">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#D7E0EB] border-t-[#193B66]" />

            <div>
              <p className="font-semibold text-[#25334A]">
                Analyzing your score factors
              </p>

              <p className="mt-1 text-sm text-[#61738B]">
                Preparing your strengths and watchouts.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ERROR STATE */}

      {!loading && error && (
        <div
          role="alert"
          className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6"
        >
          <h3 className="font-bold text-amber-900">
            Explanations are temporarily unavailable
          </h3>

          <p className="mt-2 text-sm leading-6 text-amber-800">
            Your opportunity score is still available,
            but we couldn't load its detailed factors.
          </p>

          <button
            type="button"
            onClick={() => {
              setRetryCount(
                (previous) => previous + 1
              );
            }}
            className="mt-4 rounded-lg bg-[#FFD45A] px-5 py-2.5 text-sm font-semibold text-[#25334A]"
          >
            Try again
          </button>
        </div>
      )}

      {/* STRENGTHS AND WATCHOUTS */}

      {!loading && !error && reasons && (
        <>
          <div className="mt-7 grid items-start gap-8 lg:grid-cols-2">
            <FactorSection
              title="Strengths"
              subtitle="Factors supporting your opportunity score"
              factors={positiveFactors}
              positive={true}
              maxImpact={maxImpact}
            />

            <FactorSection
              title="Watchouts"
              subtitle="Factors lowering your opportunity score"
              factors={negativeFactors}
              positive={false}
              maxImpact={maxImpact}
            />
          </div>

          {/* FACTOR EXPLANATION */}

          <div className="mt-7 rounded-2xl border border-[#D7E0EB] bg-white/70 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[#193B66]">
                <span
                  className="font-bold"
                  aria-hidden="true"
                >
                  i
                </span>
              </div>

              <div>
                <h3 className="text-sm font-bold text-[#25334A]">
                  How to read these factors
                </h3>

                <p className="mt-2 text-sm leading-6 text-[#61738B]">
                  Green factors contribute positively
                  to the model result. Red factors
                  contribute negatively. Longer bars
                  indicate larger contributions
                  relative to the factors displayed.
                  These values are not percentages
                  or direct changes to your score.
                </p>
              </div>
            </div>
          </div>

          {/* PRACTICAL RECOMMENDATIONS */}

          <NextSteps
            negativeFactors={negativeFactors}
          />
        </>
      )}

      {/* NAVIGATION */}

      <div className="mt-9 flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={() =>
            navigate("/product-overview")
          }
          className="inline-flex items-center gap-3 rounded-xl border border-[#D7E0EB] bg-white px-6 py-3 text-sm font-semibold text-[#25334A] shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <span aria-hidden="true">←</span>

          Back to overview
        </button>

        <p className="text-xs text-[#94A3B8]">
          MarketLens Product Intelligence
        </p>
      </div>
    </main>
  );
}
