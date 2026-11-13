
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  Lightbulb,
  RotateCcw,
  TrendingUp,
} from "lucide-react";

import { getPredictionReasons } from "../services/marketlensApi";
import { getScoreBand } from "../constants/scoreBands";
import InfoDialog from "../components/InfoDialog";
import OpportunityGauge from "../components/OpportunityGauge";

// ========================================
// FORMATTING
// ========================================

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

function numeric(value) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    !Number.isFinite(Number(value))
  ) {
    return null;
  }

  return Number(value);
}

function currency(value) {
  const amount = numeric(value);

  return amount === null
    ? "—"
    : currencyFormatter.format(amount);
}

function formattedNumber(value) {
  const amount = numeric(value);

  return amount === null
    ? "—"
    : numberFormatter.format(amount);
}

function sortedFactors(factors) {
  if (!Array.isArray(factors)) return [];

  return [...factors].sort(
    (a, b) =>
      Math.abs(numeric(b?.impact) ?? 0) -
      Math.abs(numeric(a?.impact) ?? 0)
  );
}

// ========================================
// SHARED DESIGN STYLES
// ========================================

const hoverCard =
  "transition-[background-color,box-shadow,transform] " +
  "duration-200 ease-out hover:-translate-y-[2px] " +
  "hover:bg-[#F8EEE0] hover:shadow-offset " +
  "motion-reduce:transform-none " +
  "motion-reduce:transition-none";

const primaryButton =
  "inline-flex items-center justify-center gap-3 " +
  "border border-ink bg-primary px-6 py-3 " +
  "font-semibold text-primary-foreground shadow-offset " +
  "transition-transform duration-150 " +
  "hover:translate-x-[2px] hover:translate-y-[2px] " +
  "focus-visible:outline-2 focus-visible:outline-offset-4 " +
  "focus-visible:outline-primary";

// ========================================
// BUSINESS-FRIENDLY SCORE LANGUAGE
// ========================================

function getOpportunityMessage(score) {
  if (score === null) {
    return {
      headline: "Your opportunity is being evaluated.",
      summary:
        "Review the available information before making a business decision.",
      nextStep:
        "Start by reviewing similar products and customer needs.",
    };
  }

  if (score >= 90) {
    return {
      headline: "A promising opportunity to explore.",
      summary:
        "This product compares favorably with many products in its category. It may deserve further research before you commit resources.",
      nextStep:
        "Look into customer demand, competition, and the costs of bringing this product to market.",
    };
  }

  if (score >= 80) {
    return {
      headline: "An opportunity worth a closer look.",
      summary:
        "This product has a relatively strong evaluation. There may be potential here, but the business details still matter.",
      nextStep:
        "Research competing products and check whether your proposed pricing leaves room for profit.",
    };
  }

  if (score >= 40) {
    return {
      headline: "An average opportunity.",
      summary:
        "This product may be worth exploring, but there are important factors to review before making a decision.",
      nextStep:
        "Compare similar products, understand customer demand, and review your pricing before investing.",
    };
  }

  return {
    headline: "An opportunity that needs more research.",
    summary:
      "This product received a relatively low evaluation compared with other products in its category. Consider investigating the challenges before moving forward.",
    nextStep:
      "Look for ways to differentiate the product, understand potential customers, and examine the competitive landscape.",
  };
}

// ========================================
// SHARED SECTION HEADING
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
// FRIENDLY FACTOR EXPLANATIONS
// ========================================

const FACTOR_GUIDANCE = {
  title_words: {
    positive: "Your product title is a positive factor",
    negative: "Review the length of your product title",
    description:
      "The length of your product title was associated with this evaluation.",
    consideration:
      "Make sure your title is clear, easy to read, and includes the details shoppers need.",
  },

  title_score: {
    positive: "Your product wording is a positive factor",
    negative: "Review how your product is described",
    description:
      "Patterns in your product title's wording influenced the evaluation. This does not identify specific words as the cause.",
    consideration:
      "Ask whether a shopper could quickly understand what your product is, what it does, and who it is for.",
  },

  brand_size_log: {
    positive: "Brand presence is a positive factor",
    negative: "Brand presence deserves a closer look",
    description:
      "A characteristic associated with the brand's presence contributed to the evaluation.",
    consideration:
      "Look at competing brands and consider how customers would discover and recognize your product.",
  },

  brand_cat_rate: {
    positive: "Brand experience in this category is a positive factor",
    negative: "Review the competitive landscape",
    description:
      "A pattern associated with the brand's track record in this product category contributed to the evaluation.",
    consideration:
      "Research established competitors and identify customer needs that might not be fully addressed.",
  },

  title_caps_ratio: {
    positive: "Title formatting is a positive factor",
    negative: "Review your product title formatting",
    description:
      "Capitalization patterns in the title contributed to the evaluation.",
    consideration:
      "Use clear, consistent capitalization and prioritize readability for customers.",
  },
};

function factorInterpretation(reason, positive) {
  const feature = String(reason?.feature || "");
  const guidance = FACTOR_GUIDANCE[feature];

  if (guidance) {
    return {
      title: positive
        ? guidance.positive
        : guidance.negative,
      description: guidance.description,
      consideration: guidance.consideration,
    };
  }

  if (feature.startsWith("title_emb_")) {
    return {
      title: positive
        ? "Your product description is a positive factor"
        : "Review how clearly your product is described",
      description:
        "A pattern related to the meaning of your product title contributed to the evaluation. It does not establish that any particular keyword is responsible.",
      consideration:
        "Check whether your title accurately communicates the product's purpose and important features.",
    };
  }

  if (feature === "price") {
    return {
      title: positive
        ? "Your price is a positive factor"
        : "Review your proposed selling price",
      description:
        "Your selling price was one of the characteristics associated with this evaluation.",
      consideration:
        "Compare the prices of similar products and estimate your costs to determine whether your pricing is competitive and sustainable.",
    };
  }

  if (
    feature === "list_price" ||
    feature === "discount_pct"
  ) {
    return {
      title: positive
        ? "Your pricing details are a positive factor"
        : "Review your pricing strategy",
      description:
        "The relationship between your selling price and listed price contributed to the evaluation.",
      consideration:
        "Check your pricing against comparable products and make sure discounts fit your business goals.",
    };
  }

  if (feature === "category") {
    return {
      title: positive
        ? "Your product category is a positive factor"
        : "Research your product category",
      description:
        "The category associated with your product contributed to its evaluation.",
      consideration:
        "Explore the types of products already sold in this category and consider how your offering could stand out.",
    };
  }

  return {
    title:
      reason?.label ||
      (positive
        ? "Another factor looks promising"
        : "Another area deserves attention"),
    description: positive
      ? "This product characteristic contributed positively to the evaluation."
      : "This product characteristic contributed negatively to the evaluation.",
    consideration:
      "Consider this finding alongside customer needs, competing products, costs, and other business information.",
  };
}

// ========================================
// FIND PRACTICAL NEXT STEP
// ========================================

function getRecommendedAction(reasons, fallback) {
  const watchouts = sortedFactors(
    reasons?.reasons_down
  );

  if (watchouts.length === 0) {
    return fallback;
  }

  const mostImportant = watchouts[0];

  return factorInterpretation(
    mostImportant,
    false
  ).consideration;
}

// ========================================
// SCORE HERO
// ========================================

function ScoreHero({
  prediction,
  reasons,
  onExplore,
}) {
  const score = numeric(
    prediction?.opportunity_score
  );

  const band = getScoreBand(score);
  const message = getOpportunityMessage(score);

  const positive = sortedFactors(
    reasons?.reasons_up
  ).slice(0, 2);

  const negative = sortedFactors(
    reasons?.reasons_down
  ).slice(0, 2);

  return (
    <section className="mt-10 border border-ink bg-card shadow-offset">
      <div className="grid lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="flex flex-col items-center justify-center border-b border-ink bg-foreground p-8 text-center text-background lg:border-b-0 lg:border-r">
          <p className="eyebrow text-background/70">
            Product opportunity
          </p>

          <div className="mt-7 rounded-full bg-card p-4">
            <OpportunityGauge score={score} />
          </div>

          <p className="mt-6 font-display text-xl">
            Your opportunity score
          </p>

          <p className="mt-2 max-w-[220px] text-center text-xs leading-relaxed text-background/70">
            A comparison with other products in this
            category.
          </p>
        </div>

        <div className="p-6 sm:p-9">
          <p className="eyebrow text-primary">
            Your evaluation
          </p>

          <h2 className="mt-4 font-display text-4xl leading-tight">
            Is this product{" "}
            <em className="text-primary">
              worth exploring?
            </em>
          </h2>

          <div className="mt-7 flex flex-wrap items-center gap-4">
            <span className="border border-ink bg-[#F8EEE0] px-4 py-2 font-mono text-sm font-semibold">
              {score === null
                ? "—"
                : `${score}/100`}
            </span>

            <span className="text-sm font-semibold">
              {band.label} opportunity
            </span>
          </div>

          <h3 className="mt-6 font-display text-2xl">
            {message.headline}
          </h3>

          <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
            {message.summary}
          </p>

          {(positive.length > 0 ||
            negative.length > 0) && (
            <div className="mt-6 flex flex-wrap gap-2">
              {positive.map((reason, index) => (
                <span
                  key={`positive-${index}`}
                  className="border border-[#8AB6A4] bg-[#E8F3EC] px-3 py-2 text-xs text-[#255D49]"
                >
                  +{" "}
                  {factorInterpretation(
                    reason,
                    true
                  ).title}
                </span>
              ))}

              {negative.map((reason, index) => (
                <span
                  key={`negative-${index}`}
                  className="border border-primary/50 bg-[#F8EEE0] px-3 py-2 text-xs text-foreground"
                >
                  −{" "}
                  {factorInterpretation(
                    reason,
                    false
                  ).title}
                </span>
              ))}
            </div>
          )}

          <div className="mt-8 flex flex-wrap gap-4">
            <button
              type="button"
              onClick={onExplore}
              className={primaryButton}
            >
              Explore your findings
              <ArrowRight size={17} />
            </button>

            <Link
              to="/score-details"
              className="inline-flex items-center justify-center border border-ink bg-card px-6 py-3 text-sm font-semibold transition-colors hover:bg-[#F8EEE0]"
            >
              Understand your results
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ========================================
// RESULTS SUMMARY
// ========================================

function ScoreSummary({
  prediction,
  reasons,
}) {
  const score = numeric(
    prediction?.opportunity_score
  );

  const band = getScoreBand(score);
  const message = getOpportunityMessage(score);

  const nextStep = getRecommendedAction(
    reasons,
    message.nextStep
  );

  return (
    <section className="mt-14">
      <SectionHeading
        number="01"
        eyebrow="Your results"
        title="Your results, at a glance."
        description="Start with the overall opportunity, then explore what deserves more attention."
      />

      <div className="mt-7 grid gap-5 md:grid-cols-3">
        <article
          className={
            `flex min-h-52 flex-col justify-between border border-ink bg-[#F8EEE0] p-6 ${hoverCard}`
          }
        >
          <p className="eyebrow text-muted-foreground">
            Opportunity score
          </p>

          <div className="mt-8">
            <p className="font-display text-4xl leading-tight">
              {score === null
                ? "—"
                : `${score}/100`}
            </p>

            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              How this product compares within its
              category.
            </p>
          </div>
        </article>

        <article
          className={
            `flex min-h-52 flex-col justify-between border border-ink bg-card p-6 ${hoverCard}`
          }
        >
          <p className="eyebrow text-muted-foreground">
            Opportunity rating
          </p>

          <div className="mt-8">
            <p className="font-display text-4xl leading-tight">
              {band.label}
            </p>

            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {message.summary}
            </p>
          </div>
        </article>

        <article
          className={
            `flex min-h-52 flex-col justify-between border border-ink bg-card p-6 ${hoverCard}`
          }
        >
          <p className="eyebrow text-muted-foreground">
            What to consider next
          </p>

          <div className="mt-8">
            <Lightbulb
              size={24}
              className="text-primary"
              aria-hidden="true"
            />

            <p className="mt-4 text-sm leading-relaxed">
              {nextStep}
            </p>
          </div>
        </article>
      </div>
    </section>
  );
}

// ========================================
// INDIVIDUAL INSIGHT CARD
// ========================================

function InsightCard({
  reason,
  positive,
}) {
  const [expanded, setExpanded] =
    useState(false);

  const guidance = factorInterpretation(
    reason,
    positive
  );

  return (
    <article className="border border-ink bg-card">
      <button
        type="button"
        onClick={() =>
          setExpanded((value) => !value)
        }
        aria-expanded={expanded}
        className="flex w-full items-start gap-4 p-5 text-left transition-colors hover:bg-[#F8EEE0] sm:p-6"
      >
        <span
          className={
            "flex size-10 shrink-0 items-center justify-center border border-ink " +
            (positive
              ? "bg-[#E8F3EC]"
              : "bg-[#F8EEE0]")
          }
        >
          {positive ? (
            <TrendingUp size={19} />
          ) : (
            <Lightbulb size={19} />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-relaxed">
            {guidance.title}
          </p>

          <p className="mt-2 text-xs text-muted-foreground">
            {positive
              ? "What looks promising"
              : "What to look into"}
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
      </button>

      {expanded && (
        <div className="border-t border-border px-5 pb-6 pt-5 sm:px-6">
          <h4 className="text-sm font-semibold">
            Why this matters
          </h4>

          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            {guidance.description}
          </p>

          <div className="mt-5 border-l-2 border-primary bg-[#F8EEE0] p-4">
            <p className="text-sm font-semibold">
              What you can do next
            </p>

            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {guidance.consideration}
            </p>
          </div>
        </div>
      )}
    </article>
  );
}

// ========================================
// PRODUCT INSIGHTS
// ========================================

function ProductInsights({
  reasons,
  loading,
  error,
  onRetry,
}) {
  const [category, setCategory] =
    useState("strengths");

  const strengths = sortedFactors(
    reasons?.reasons_up
  );

  const watchouts = sortedFactors(
    reasons?.reasons_down
  );

  const items =
    category === "strengths"
      ? strengths
      : watchouts;

  return (
    <div className="mt-7">
      <div
        role="group"
        aria-label="Product findings"
        className="grid gap-4 sm:grid-cols-2"
      >
        {[
          {
            id: "strengths",
            title: "What's working in my favor?",
            count: strengths.length,
            description: "What looks promising",
          },
          {
            id: "watchouts",
            title: "What should I investigate?",
            count: watchouts.length,
            description: "What to look into",
          },
        ].map((option) => {
          const active = category === option.id;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() =>
                setCategory(option.id)
              }
              aria-pressed={active}
              className={
                "border border-ink p-5 text-left " +
                (active
                  ? "bg-[#F8EEE0] shadow-offset "
                  : `bg-card ${hoverCard}`)
              }
            >
              <p className="text-sm font-semibold">
                {option.title}
              </p>

              <p className="mt-4 font-display text-3xl">
                {reasons
                  ? option.count
                  : "—"}
              </p>

              <p className="mt-2 text-xs text-muted-foreground">
                {option.description}
              </p>
            </button>
          );
        })}
      </div>

      {loading && (
        <p
          role="status"
          className="mt-6 border border-ink bg-card p-6 text-sm text-muted-foreground"
        >
          Preparing your product findings...
        </p>
      )}

      {error && !loading && (
        <div
          role="alert"
          className="mt-6 border border-ink bg-[#F8EEE0] p-6"
        >
          <p className="text-sm">
            {error}
          </p>

          <button
            type="button"
            onClick={onRetry}
            className="mt-3 text-sm font-semibold text-primary underline"
          >
            Try again
          </button>
        </div>
      )}

      {reasons && !loading && (
        <div className="mt-6 space-y-4">
          {items.length ? (
            items.map((reason, index) => (
              <InsightCard
                key={`${category}-${reason?.feature || index}-${index}`}
                reason={reason}
                positive={
                  category === "strengths"
                }
              />
            ))
          ) : (
            <div className="border border-ink bg-card p-6 text-sm text-muted-foreground">
              No additional findings are available
              in this category.
            </div>
          )}
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <Link
          to="/score-details"
          className="inline-flex items-center gap-2 border border-ink bg-card px-5 py-3 text-sm font-semibold transition-colors hover:bg-[#F8EEE0]"
        >
          Understand your results
          <ArrowRight size={17} />
        </Link>
      </div>
    </div>
  );
}

// ========================================
// PRODUCT INFORMATION
// ========================================

function ProductInformation({ product }) {
  const details = [
    {
      label: "Product category",
      value:
        product.categoryName ||
        product.category ||
        "—",
    },
    {
      label: "Selling price",
      value: currency(product.price),
    },
    {
      label: "Customer reviews",
      value:
        product.reviews == null
          ? "—"
          : formattedNumber(product.reviews),
    },
  ];

  return (
    <section className="mt-14">
      <SectionHeading
        number="03"
        eyebrow="Product details"
        title="Your product information."
        description="The details you provided for this evaluation."
      />

      <div className="mt-7 grid gap-5 md:grid-cols-3">
        {details.map((detail) => (
          <article
            key={detail.label}
            className={`min-w-0 border border-ink bg-card p-6 ${hoverCard}`}
          >
            <p className="eyebrow text-muted-foreground">
              {detail.label}
            </p>

            <p className="mt-6 break-words font-display text-2xl">
              {detail.value}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

// ========================================
// PRICE SCENARIOS
// ========================================

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

  const adjustedPrice = numeric(selectedPrice);

  const validPrice =
    adjustedPrice !== null &&
    adjustedPrice >= 0.01 &&
    adjustedPrice <= 100000;

  const change =
    validPrice && originalPrice > 0
      ? (
          (adjustedPrice / originalPrice - 1) *
          100
        )
      : null;

  return (
    <section className="mt-14">
      <SectionHeading
        number="04"
        eyebrow="Pricing strategy"
        title="Explore a different price."
        description="See how your proposed selling price compares with the original, then explore pricing scenarios."
      />

      <div className="mt-7 grid border border-ink bg-card shadow-offset lg:grid-cols-2">
        <div className="p-6 sm:p-8">
          <p className="eyebrow text-muted-foreground">
            Price scenario
          </p>

          <div className="mt-7 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">
                Original price
              </p>

              <p className="mt-3 font-display text-3xl">
                {currency(originalPrice)}
              </p>
            </div>

            <div>
              <label
                htmlFor="preview-price"
                className="text-sm text-muted-foreground"
              >
                New selling price
              </label>

              <div className="mt-2 flex items-center border border-ink bg-card px-4">
                <span className="text-sm">
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
                  className="h-12 min-w-0 w-full bg-transparent px-3 font-semibold outline-none"
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
                      adjustedPrice
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
            className="mt-9 w-full accent-[#D95332]"
          />

          <div className="mt-3 flex justify-between font-mono text-xs text-muted-foreground">
            <span>
              {currency(minPrice)}
            </span>

            <span>
              {currency(maxPrice)}
            </span>
          </div>

          <button
            type="button"
            onClick={() =>
              setSelectedPrice(
                String(originalPrice)
              )
            }
            className="mt-7 inline-flex items-center gap-2 text-sm font-semibold transition-colors hover:text-primary"
          >
            <RotateCcw size={16} />
            Reset price
          </button>
        </div>

        <div className="flex flex-col justify-between border-t border-ink bg-[#F8EEE0] p-6 sm:p-8 lg:border-l lg:border-t-0">
          <div>
            <p className="eyebrow text-muted-foreground">
              Price adjustment
            </p>

            <p className="mt-5 font-display text-5xl">
              {change === null
                ? "—"
                : `${change > 0 ? "+" : ""}${change.toFixed(1)}%`}
            </p>

            <p className="mt-4 text-sm text-muted-foreground">
              {validPrice
                ? `New price: ${currency(adjustedPrice)}`
                : "Enter a valid selling price."}
            </p>
          </div>

          <Link
            to="/launch-feasibility"
            state={{
              suggestedPrice: validPrice
                ? adjustedPrice
                : originalPrice,
            }}
            aria-disabled={!validPrice}
            tabIndex={
              validPrice ? undefined : -1
            }
            className={
              `mt-9 w-fit ${primaryButton} ` +
              (!validPrice
                ? "pointer-events-none opacity-50"
                : "")
            }
          >
            Explore price scenarios
            <ArrowRight size={17} />
          </Link>
        </div>
      </div>

      <p className="mt-4 text-xs leading-6 text-muted-foreground">
        This preview shows how much the price
        changes. It does not calculate new sales
        or profits. You can explore the effect
        of different prices in the next step.
      </p>
    </section>
  );
}

// ========================================
// ABOUT THE OPPORTUNITY SCORE
// ========================================

function AboutScore({ prediction }) {
  const score = numeric(
    prediction?.opportunity_score
  );

  const band = getScoreBand(score);

  return (
    <InfoDialog
      triggerLabel="About the opportunity score"
      title="Understanding your score"
      closeButtonClassName={primaryButton}
    >
            <p className="mt-5 text-sm leading-7 text-muted-foreground">
              Your opportunity score compares
              your product with others in its
              category. A higher score means a
              more favorable comparison.
            </p>

            <div className="mt-6 border border-ink bg-[#F8EEE0] p-5">
              <p className="eyebrow text-muted-foreground">
                Your current result
              </p>

              <p className="mt-3 font-display text-2xl">
                {score === null
                  ? "—"
                  : `${score}/100`}
                {" · "}
                {band.label}
              </p>

              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {getOpportunityMessage(score).summary}
              </p>
            </div>

            <h3 className="mt-6 font-semibold">
              What doesn't this score tell me?
            </h3>

            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              It does not guarantee that your
              product will sell or make a profit.
              Costs, customer demand, competition,
              and execution all affect business
              performance.
            </p>

            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              Use this evaluation as one source
              of information when researching
              your product idea.
            </p>
    </InfoDialog>
  );
}

// ========================================
// MAIN PRODUCT OVERVIEW PAGE
// ========================================

export default function Overview({
  product,
  prediction,
}) {
  const [
    showExplanations,
    setShowExplanations,
  ] = useState(false);

  const [
    loadedReasons,
    setLoadedReasons,
  ] = useState(null);

  const [
    loadingReasons,
    setLoadingReasons,
  ] = useState(false);

  const [
    reasonsError,
    setReasonsError,
  ] = useState("");

  const [
    retryCount,
    setRetryCount,
  ] = useState(0);

  const score = numeric(
    prediction?.opportunity_score
  );

  const hasScore = score !== null;

  const reasons =
    loadedReasons?.product === product &&
    loadedReasons?.prediction === prediction
      ? loadedReasons.data
      : null;

  // ----------------------------------------
  // RETRIEVE PRODUCT FINDINGS
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
      } catch {
        if (active) {
          setReasonsError(
            "We couldn't load your product findings. Please try again."
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
      (value) => value + 1
    );
  }

  function exploreInsights() {
    setShowExplanations(true);

    requestAnimationFrame(() => {
      document
        .getElementById(
          "opportunity-product-insights"
        )
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    });
  }

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
          Evaluate a product to view its
          opportunity score and findings.
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

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-5 pb-24 pt-12 sm:px-8 lg:pt-16">
        <Link
          to="/discover"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft size={16} />
          Back to Discovery
        </Link>

        {/* PAGE HEADER */}

        <header className="mt-10 border-b border-ink pb-10">
          <p className="eyebrow flex items-center gap-3 text-muted-foreground">
            <span className="text-primary">
              02
            </span>

            <span className="h-px w-8 bg-current" />

            Product opportunity
          </p>

          <h1 className="mt-6 font-display text-5xl leading-tight sm:text-6xl">
            Your product{" "}
            <em className="text-primary">
              outlook.
            </em>
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Understand your product's potential,
            explore important findings, and
            decide what to investigate next.
          </p>

          <div className="mt-8 border-l-2 border-primary pl-5">
            <p className="eyebrow text-muted-foreground">
              Evaluated product
            </p>

            <h2 className="mt-2 break-words font-display text-2xl">
              {product.title}
            </h2>
          </div>
        </header>

        {/* OPPORTUNITY SCORE */}

        <ScoreHero
          prediction={prediction}
          reasons={reasons}
          onExplore={exploreInsights}
        />

        {/* RESULTS SUMMARY */}

        <ScoreSummary
          prediction={prediction}
          reasons={reasons}
        />

        {/* PRODUCT FINDINGS */}

        <section
          id="opportunity-product-insights"
          className="mt-14 scroll-mt-8"
        >
          <div className="flex flex-wrap items-end justify-between gap-5">
            <SectionHeading
              number="02"
              eyebrow="Product findings"
              title="What should you know?"
              description="Explore the characteristics helping your product's evaluation and the areas that may need more research."
            />

            <button
              type="button"
              onClick={() =>
                setShowExplanations(
                  (value) => !value
                )
              }
              aria-expanded={
                showExplanations
              }
              aria-controls="opportunity-insights-content"
              className="inline-flex items-center gap-2 border border-ink bg-card px-5 py-3 text-sm font-semibold transition-colors hover:bg-[#F8EEE0]"
            >
              {showExplanations
                ? "Hide findings"
                : "Explore findings"}

              {showExplanations ? (
                <ChevronUp size={17} />
              ) : (
                <ChevronDown size={17} />
              )}
            </button>
          </div>

          {showExplanations && (
            <div id="opportunity-insights-content">
              <ProductInsights
                reasons={reasons}
                loading={loadingReasons}
                error={reasonsError}
                onRetry={retryExplanations}
              />
            </div>
          )}
        </section>

        {/* PRODUCT INFORMATION */}

        <ProductInformation
          product={product}
        />

        {/* PRICE EXPLORATION */}

        {numeric(product.price) !== null &&
          Number(product.price) > 0 && (
            <PriceScenarioPreview
              key={JSON.stringify(product)}
              product={product}
            />
          )}

        {/* NEXT ANALYSIS */}

        <section className="mt-14 flex flex-col items-start justify-between gap-5 border-t border-ink pt-8 sm:flex-row sm:items-center">
          <div>
            <p className="eyebrow text-primary">
              Continue exploring
            </p>

            <h2 className="mt-3 font-display text-2xl">
              Have another product in mind?
            </h2>

            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Compare other product ideas before
              deciding where to invest your time
              and resources.
            </p>
          </div>

          <Link
            to="/discover"
            className={primaryButton}
          >
            Explore another product
            <ArrowRight size={18} />
          </Link>
        </section>

        {/* SCORE INFORMATION */}

        <AboutScore
          prediction={prediction}
        />

        <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
          <CircleHelp size={15} />

          <span>
            Results are estimates intended to
            support research, not guarantees
            of business performance.
          </span>
        </div>
      </div>
    </main>
  );
}
