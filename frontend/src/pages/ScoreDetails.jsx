
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  CircleHelp,
  Info,
  Lightbulb,
  TrendingUp,
} from "lucide-react";

import { getPredictionReasons } from "../services/marketlensApi";
import { getScoreBand } from "../constants/scoreBands";
import OpportunityGauge from "../components/OpportunityGauge";

// ========================================
// BUSINESS-FRIENDLY EXPLANATIONS
// ========================================

const FEATURE_DETAILS = {
  title_words: {
    title: "Product title length",
    explanation:
      "The length of your product title was associated with this evaluation.",
    action:
      "Make your title easy to scan. Include the information shoppers need without adding unnecessary words.",
  },
  title_score: {
    title: "How your product is described",
    explanation:
      "Patterns in the wording of your product title influenced the evaluation. This does not identify individual words as the cause.",
    action:
      "Check whether a customer can quickly understand what the product is, what it does, and who it is for.",
  },
  title_caps_ratio: {
    title: "Product title formatting",
    explanation:
      "Capitalization patterns in your product title were associated with the evaluation.",
    action:
      "Use consistent capitalization and prioritize readability over unnecessary emphasis.",
  },
  brand_size_log: {
    title: "Brand presence",
    explanation:
      "A characteristic associated with the brand's presence contributed to this evaluation.",
    action:
      "Research competing brands and consider how customers would discover and recognize your product.",
  },
  brand_cat_rate: {
    title: "Brand experience in this category",
    explanation:
      "A pattern associated with the brand's track record in this product category influenced the evaluation.",
    action:
      "Study established competitors and look for customer needs that may not be fully addressed.",
  },
  category: {
    title: "Product category",
    explanation:
      "Your product's category was one of the characteristics associated with its evaluation.",
    action:
      "Explore the types of products already sold in this category and consider how yours could stand out.",
  },
  price: {
    title: "Your selling price",
    explanation:
      "Your proposed selling price contributed to the evaluation. This alone does not establish whether the price is too high or too low.",
    action:
      "Compare similar products and estimate your costs before deciding whether your price is competitive and profitable.",
  },
  list_price: {
    title: "Your pricing details",
    explanation:
      "The listed price was one of the characteristics considered in this evaluation.",
    action:
      "Check whether your listed price and selling price make sense compared with competing products.",
  },
  discount_pct: {
    title: "Your pricing strategy",
    explanation:
      "The relationship between your listed price and selling price contributed to the evaluation.",
    action:
      "Review similar products' pricing and make sure any discount leaves enough room to cover your costs.",
  },
};

function getExplanation(factor) {
  const feature = String(factor?.feature || "");

  if (FEATURE_DETAILS[feature]) {
    return FEATURE_DETAILS[feature];
  }

  if (feature.startsWith("title_emb_")) {
    return {
      title: "The meaning of your product title",
      explanation:
        "A pattern related to the meaning of your product title was associated with this evaluation. It does not identify a specific keyword problem.",
      action:
        "Make sure the title accurately describes the product and its most important features.",
    };
  }

  return {
    title:
      factor?.label &&
      !/[_\d]/.test(String(factor.label))
        ? String(factor.label)
        : "Another product characteristic",
    explanation:
      "This product characteristic contributed to the evaluation, but a more specific business interpretation is not available.",
    action:
      "Research customer needs, competing products, and potential costs before drawing conclusions from this finding.",
  };
}

function normalizeGroup(items, positive) {
  if (!Array.isArray(items)) return [];

  return items
    .map((item, index) => {
      const impact = Number(item?.impact);

      if (!Number.isFinite(impact)) {
        return null;
      }

      const factor = {
        ...item,
        feature: item?.feature || "",
      };

      return {
        id: `${positive ? "positive" : "negative"}-${index}`,
        impact,
        positive,
        ...getExplanation(factor),
      };
    })
    .filter(Boolean)
    .sort(
      (a, b) =>
        Math.abs(b.impact) - Math.abs(a.impact)
    );
}

function getScoreMessage(score) {
  if (score >= 90) {
    return "This product compares favorably with many others in its category. Research demand, competition, and costs before committing resources.";
  }

  if (score >= 80) {
    return "This product has a relatively strong evaluation. Explore the market and check whether the business opportunity is practical.";
  }

  if (score >= 40) {
    return "This product has an average evaluation. There may be potential, but important details deserve further research.";
  }

  return "This product received a relatively low evaluation. Investigate its challenges and consider whether there is a way to differentiate it.";
}

// ========================================
// SHARED DESIGN STYLES
// ========================================

const primaryButton =
  "inline-flex items-center justify-center gap-3 " +
  "border border-ink bg-primary px-6 py-3 " +
  "font-semibold text-primary-foreground shadow-offset " +
  "transition-transform duration-150 " +
  "hover:translate-x-[2px] hover:translate-y-[2px] " +
  "focus-visible:outline-2 focus-visible:outline-offset-4 " +
  "focus-visible:outline-primary";

// ========================================
// PAGE HEADINGS
// ========================================

function SectionHeading({
  number,
  eyebrow,
  title,
  description,
}) {
  return (
    <div>
      <p className="eyebrow flex items-center gap-3 text-muted-foreground">
        <span className="text-primary">{number}</span>
        <span className="h-px w-8 bg-current" />
        {eyebrow}
      </p>

      <h2 className="mt-4 font-display text-3xl leading-tight sm:text-4xl">
        {title}
      </h2>

      {description && (
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}

// ========================================
// OPPORTUNITY SUMMARY
// ========================================

function OpportunitySummary({
  product,
  score,
}) {
  const band = getScoreBand(score);

  return (
    <section className="mt-10 border border-ink bg-card shadow-offset">
      <div className="grid lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="flex flex-col items-center justify-center border-b border-ink bg-foreground p-8 text-center text-background lg:border-b-0 lg:border-r">
          <p className="eyebrow text-background/70">
            Your opportunity score
          </p>

          <div className="mt-7 rounded-full bg-card p-4">
            <OpportunityGauge score={score} />
          </div>

          <p className="mt-6 text-sm text-background/75">
            Compared within its category
          </p>
        </div>

        <div className="p-6 sm:p-9">
          <p className="eyebrow text-primary">
            Your product
          </p>

          <h2 className="mt-4 break-words font-display text-3xl leading-tight">
            {product.title}
          </h2>

          {product.categoryName && (
            <p className="mt-3 text-sm text-muted-foreground">
              {product.categoryName}
            </p>
          )}

          <div className="mt-7 inline-flex border border-ink bg-[#F8EEE0] px-4 py-2 text-sm font-semibold">
            {band.label} opportunity
          </div>

          <h3 className="mt-6 font-display text-2xl">
            What does this mean for you?
          </h3>

          <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
            {getScoreMessage(score)}
          </p>

          <div className="mt-6 flex items-start gap-3 border-l-2 border-primary bg-[#F8EEE0] p-4">
            <Info
              size={18}
              className="mt-0.5 shrink-0 text-primary"
            />

            <p className="text-xs leading-relaxed text-muted-foreground">
              This evaluation helps you compare
              product ideas. It does not guarantee
              sales or profitability.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ========================================
// INDIVIDUAL FINDING
// ========================================

function FindingCard({
  factor,
  maxImpact,
}) {
  const [expanded, setExpanded] = useState(false);

  const relativeStrength =
    maxImpact > 0
      ? (Math.abs(factor.impact) / maxImpact) * 100
      : 0;

  const strengthLabel =
    relativeStrength >= 70
      ? "Larger influence"
      : relativeStrength >= 35
        ? "Moderate influence"
        : "Smaller influence";

  return (
    <article className="border border-ink bg-card">
      <button
        type="button"
        onClick={() =>
          setExpanded((previous) => !previous)
        }
        aria-expanded={expanded}
        className="w-full p-5 text-left transition-colors hover:bg-[#F8EEE0] sm:p-6"
      >
        <div className="flex items-start gap-4">
          <span
            className={
              "flex size-10 shrink-0 items-center justify-center border border-ink " +
              (factor.positive
                ? "bg-[#E8F3EC]"
                : "bg-[#F8EEE0]")
            }
          >
            {factor.positive ? (
              <TrendingUp
                size={19}
                aria-hidden="true"
              />
            ) : (
              <Lightbulb
                size={19}
                aria-hidden="true"
              />
            )}
          </span>

          <div className="min-w-0 flex-1">
            <h3 className="font-semibold leading-relaxed">
              {factor.title}
            </h3>

            <p className="mt-2 text-xs text-muted-foreground">
              {strengthLabel} among the findings shown
            </p>
          </div>

          {expanded ? (
            <ChevronUp
              size={18}
              className="mt-2 shrink-0"
            />
          ) : (
            <ChevronDown
              size={18}
              className="mt-2 shrink-0"
            />
          )}
        </div>

        <div
          className="mt-6 h-2 overflow-hidden bg-secondary"
          aria-hidden="true"
        >
          <div
            className={
              "h-full transition-[width] duration-300 " +
              (factor.positive
                ? "bg-[#47866B]"
                : "bg-primary")
            }
            style={{
              width: `${relativeStrength}%`,
            }}
          />
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          {expanded
            ? "Hide explanation"
            : "Understand this finding"}
        </p>
      </button>

      {expanded && (
        <div className="border-t border-border px-5 pb-6 pt-5 sm:px-6">
          <h4 className="text-sm font-semibold">
            Why this matters
          </h4>

          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            {factor.explanation}
          </p>

          <div className="mt-5 border-l-2 border-primary bg-[#F8EEE0] p-4">
            <p className="text-sm font-semibold">
              What you can do next
            </p>

            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              {factor.action}
            </p>
          </div>
        </div>
      )}
    </article>
  );
}

// ========================================
// FINDINGS COLUMN
// ========================================

function FindingsColumn({
  title,
  subtitle,
  factors,
  positive,
  maxImpact,
}) {
  return (
    <section className="min-w-0">
      <div className="mb-6 border-b border-ink pb-5">
        <div className="flex items-start gap-3">
          <span
            className={
              "flex size-11 shrink-0 items-center justify-center border border-ink " +
              (positive
                ? "bg-[#E8F3EC]"
                : "bg-[#F8EEE0]")
            }
          >
            {positive ? (
              <TrendingUp size={21} />
            ) : (
              <CircleAlert size={21} />
            )}
          </span>

          <div>
            <h3 className="font-display text-2xl">
              {title}
            </h3>

            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {subtitle}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {factors.length > 0 ? (
          factors.map((factor) => (
            <FindingCard
              key={factor.id}
              factor={factor}
              maxImpact={maxImpact}
            />
          ))
        ) : (
          <div className="border border-ink bg-card p-6 text-sm text-muted-foreground">
            No additional findings are available
            in this category.
          </div>
        )}
      </div>
    </section>
  );
}

// ========================================
// SUGGESTED NEXT STEPS
// ========================================

function NextSteps({
  concerns,
  hasFindings,
}) {
  const specificSteps = [
    ...new Set(
      concerns.map((factor) => factor.action)
    ),
  ].slice(0, 3);

  const generalSteps = [
    "Compare the prices and features of similar products.",
    "Look at customer reviews to understand unmet needs.",
    "Estimate your costs and potential profit before investing.",
  ];

  const steps =
    specificSteps.length > 0
      ? specificSteps
      : generalSteps;

  return (
    <section className="mt-14">
      <SectionHeading
        number="02"
        eyebrow="Research checklist"
        title="What should you do next?"
        description="Use these suggestions to guide your research before making a business decision."
      />

      <div className="mt-7 border border-ink bg-card p-6 shadow-offset sm:p-8">
        {hasFindings && specificSteps.length > 0 && (
          <p className="mb-6 text-sm text-muted-foreground">
            These suggestions relate to the concerns
            highlighted in your evaluation.
          </p>
        )}

        <div className="space-y-5">
          {steps.map((step, index) => (
            <div
              key={`${index}-${step}`}
              className="flex items-start gap-4 border-b border-border pb-5 last:border-b-0 last:pb-0"
            >
              <span className="flex size-9 shrink-0 items-center justify-center border border-ink bg-[#F8EEE0] font-mono text-xs">
                {String(index + 1).padStart(2, "0")}
              </span>

              <p className="pt-1 text-sm leading-7">
                {step}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-7 border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground">
          These are research suggestions, not guaranteed
          ways to improve your score or product sales.
        </p>
      </div>
    </section>
  );
}

// ========================================
// MAIN SCORE DETAILS PAGE
// ========================================

export default function ScoreDetails({
  product,
  prediction,
}) {
  const [reasons, setReasons] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  const scoreValue = prediction?.opportunity_score;

  const score =
    scoreValue === null ||
    scoreValue === undefined ||
    scoreValue === "" ||
    !Number.isFinite(Number(scoreValue))
      ? null
      : Number(scoreValue);

  const hasScore = score !== null;
  const productTitle = product?.title;

  // ----------------------------------------
  // LOAD PRODUCT FINDINGS
  // ----------------------------------------

  useEffect(() => {
    if (!hasScore || !productTitle) {
      return;
    }

    let active = true;

    async function loadReasons() {
      setLoading(true);
      setError("");
      setReasons(null);

      try {
        const response =
          await getPredictionReasons(product);

        if (active) {
          setReasons({
            positive: normalizeGroup(
              response?.reasons_up,
              true
            ),
            negative: normalizeGroup(
              response?.reasons_down,
              false
            ),
          });
        }
      } catch {
        if (active) {
          setError(
            "We couldn't load the detailed findings. Please try again."
          );
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
    hasScore,
    product,
    productTitle,
    retryCount,
  ]);

  const positiveFactors = reasons?.positive || [];
  const negativeFactors = reasons?.negative || [];

  const maxImpact = Math.max(
    0,
    ...positiveFactors
      .concat(negativeFactors)
      .map((factor) => Math.abs(factor.impact))
  );

  // ----------------------------------------
  // EMPTY STATE
  // ----------------------------------------

  if (!product || !hasScore) {
    return (
      <main className="min-h-screen bg-background px-6 py-20 text-center text-foreground">
        <h1 className="font-display text-4xl">
          No product evaluation available.
        </h1>

        <p className="mt-4 text-muted-foreground">
          Evaluate a product to explore its
          opportunity and detailed findings.
        </p>

        <Link
          to="/discover"
          className={`mt-8 ${primaryButton}`}
        >
          Discover products
          <ArrowRight size={18} />
        </Link>
      </main>
    );
  }

  // ----------------------------------------
  // PAGE CONTENT
  // ----------------------------------------

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-5 pb-24 pt-12 sm:px-8 lg:pt-16">
        <Link
          to="/product-overview"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft size={16} />
          Back to Product Overview
        </Link>

        <header className="mt-10 border-b border-ink pb-10">
          <p className="eyebrow flex items-center gap-3 text-muted-foreground">
            <span className="text-primary">03</span>
            <span className="h-px w-8 bg-current" />
            Product findings
          </p>

          <h1 className="mt-6 font-display text-5xl leading-tight sm:text-6xl">
            Understand your{" "}
            <em className="text-primary">
              opportunity.
            </em>
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Explore what's working in your favor,
            what deserves attention, and where
            to focus your research.
          </p>
        </header>

        <OpportunitySummary
          product={product}
          score={score}
        />

        <section className="mt-14">
          <SectionHeading
            number="01"
            eyebrow="Your product findings"
            title="What stands out?"
            description="Explore the characteristics associated with your evaluation. Select any finding to understand it in more detail."
          />

          {loading && (
            <div
              role="status"
              className="mt-7 border border-ink bg-card p-6"
            >
              <p className="font-semibold">
                Preparing your findings...
              </p>

              <p className="mt-2 text-sm text-muted-foreground">
                Your detailed results will appear here.
              </p>
            </div>
          )}

          {!loading && error && (
            <div
              role="alert"
              className="mt-7 border border-ink bg-[#F8EEE0] p-6"
            >
              <p className="font-semibold">
                Detailed findings unavailable
              </p>

              <p className="mt-3 text-sm text-muted-foreground">
                {error}
              </p>

              <button
                type="button"
                onClick={() =>
                  setRetryCount((count) => count + 1)
                }
                className="mt-4 font-semibold text-primary underline"
              >
                Try again
              </button>
            </div>
          )}

          {!loading && !error && reasons && (
            <>
              <div className="mt-7 grid items-start gap-8 lg:grid-cols-2">
                <FindingsColumn
                  title="What looks promising?"
                  subtitle="Characteristics that contributed positively to your evaluation."
                  factors={positiveFactors}
                  positive
                  maxImpact={maxImpact}
                />

                <FindingsColumn
                  title="What deserves attention?"
                  subtitle="Characteristics that may warrant additional research."
                  factors={negativeFactors}
                  positive={false}
                  maxImpact={maxImpact}
                />
              </div>

              <div className="mt-7 flex items-start gap-3 border border-ink bg-card p-5">
                <Info
                  size={18}
                  className="mt-0.5 shrink-0 text-primary"
                />

                <p className="text-sm leading-7 text-muted-foreground">
                  The bars compare the relative influence
                  of the findings shown. They do not
                  represent sales percentages, changes
                  to your opportunity score, or guaranteed
                  business outcomes.
                </p>
              </div>
            </>
          )}
        </section>

        {!loading && !error && reasons && (
          <NextSteps
            concerns={negativeFactors}
            hasFindings
          />
        )}

        <section className="mt-14 flex flex-col items-start justify-between gap-5 border-t border-ink pt-8 sm:flex-row sm:items-center">
          <div>
            <p className="eyebrow text-primary">
              Continue exploring
            </p>

            <h2 className="mt-3 font-display text-2xl">
              Ready to review your results?
            </h2>
          </div>

          <Link
            to="/product-overview"
            className={primaryButton}
          >
            Back to overview
            <ArrowRight size={18} />
          </Link>
        </section>

        <div className="mt-8 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <CircleHelp
            size={15}
            className="mt-0.5 shrink-0"
          />

          <span>
            These results are estimates designed to
            support product research. They do not
            guarantee sales, profitability, or
            a successful launch.
          </span>
        </div>
      </div>
    </main>
  );
}
