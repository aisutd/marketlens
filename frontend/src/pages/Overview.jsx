
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  Info,
  Lightbulb,
  MessageSquareText,
  ShieldCheck,
  ThumbsUp,
} from "lucide-react";

import { getPredictionReasons } from "../services/marketlensApi";
import { getScoreBand } from "../constants/scoreBands";
import OpportunityGauge from "../components/OpportunityGauge";
import { factorKey, factorName } from "../constants/scoreFactors";

// ========================================
// THEME AND FORMATTING
// ========================================

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

function numberOrNull(value) {
  if (
    value == null ||
    value === "" ||
    !Number.isFinite(Number(value))
  ) {
    return null;
  }

  return Number(value);
}

function currency(value) {
  const number = numberOrNull(value);
  return number === null
    ? "—"
    : currencyFormatter.format(number);
}

function formatNumber(value) {
  const number = numberOrNull(value);
  return number === null
    ? "—"
    : numberFormatter.format(number);
}

function formatMetric(metric) {
  const value = numberOrNull(metric?.value);

  if (value === null) return "—";
  if (metric.unit === "USD") return currency(value);
  if (metric.unit === "%") return `${value.toFixed(2)}%`;

  return formatNumber(value);
}

function validRange(metric) {
  const value = numberOrNull(metric?.value);
  const range = metric?.range;

  if (
    value === null ||
    !Array.isArray(range) ||
    range.length !== 2
  ) {
    return null;
  }

  const low = numberOrNull(range[0]);
  const high = numberOrNull(range[1]);

  if (
    low === null ||
    high === null ||
    low > high ||
    value < low ||
    value > high
  ) {
    return null;
  }

  return [low, high];
}

// ========================================
// SHARED SECTION HEADING
// ========================================

function SectionHeading({ eyebrow, title, description }) {
  return (
    <div>
      {eyebrow && (
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.13em] text-[#A77E1C]">
          {eyebrow}
        </p>
      )}

      <h2 className="text-xl font-bold tracking-tight text-[#25334A] sm:text-2xl">
        {title}
      </h2>

      {description && (
        <p className="mt-2 text-sm leading-6 text-[#61738B]">
          {description}
        </p>
      )}
    </div>
  );
}

// ========================================
// FRIENDLY FACTOR INTERPRETATIONS
// ========================================

// Keyed by the API's factor label (see constants/scoreFactors.js).
// These explanations describe what each model factor
// represents. They do not claim that changing the feature
// will cause the opportunity score to increase.

const FACTOR_GUIDANCE = {
  "title length": {
    strength: "Your product title's length is a positive signal",
    watchout: "Your product title's length is worth reviewing",
    explanation:
      "The number of words in your product title contributed to the model's assessment.",
    consideration:
      "Keep your title clear and easy to scan. Include the product details shoppers need without unnecessary wording.",
    icon: MessageSquareText,
  },
  "title wording": {
    strength: "Your title wording is a positive signal",
    watchout: "Your product title deserves a closer look",
    explanation:
      "The model found a contribution associated with how your product title is worded.",
    consideration:
      "Read your title from a shopper's perspective. Is it clear what the product is and why someone might choose it?",
    icon: MessageSquareText,
  },
  "brand size": {
    strength: "Brand size is working in your favor",
    watchout: "Brand size may be a challenge",
    explanation:
      "A feature related to the size of the brand contributed to the model's assessment.",
    consideration:
      "Consider how shoppers learn about your brand. Clear information and consistent product presentation can help them evaluate it.",
    icon: ShieldCheck,
  },
  "brand track record in category": {
    strength: "Brand history in this category is a positive signal",
    watchout: "Brand track record may be a challenge",
    explanation:
      "The model considered a feature related to the brand's track record in this product category.",
    consideration:
      "Review how your brand is presented in this category. Trust, accurate descriptions, and reliable customer experiences matter beyond the model score.",
    icon: ShieldCheck,
  },
  "title capitals": {
    strength: "Title capitalization contributed positively",
    watchout: "Title capitalization is worth reviewing",
    explanation:
      "The pattern of capital letters in the title contributed to the model's assessment.",
    consideration:
      "Prioritize readability and a consistent writing style. Avoid changing capitalization solely to influence a model score.",
    icon: BookOpen,
  },
  "brand track record": {
    strength: "Brand history across categories is a positive signal",
    watchout: "Brand track record overall may be a challenge",
    explanation:
      "The model considered a feature related to the brand's track record across all of its product categories.",
    consideration:
      "Consider how shoppers judge an unfamiliar brand. Accurate listings and reliable customer experiences build trust beyond the model score.",
    icon: ShieldCheck,
  },
  // Sums all title_emb_pca_* columns in the API.
  "title meaning": {
    strength: "The meaning of your title is a positive signal",
    watchout: "Your title's meaning is worth reviewing",
    explanation:
      "A text-meaning feature associated with your product title contributed to the model's assessment.",
    consideration:
      "Check whether a new shopper would immediately understand what your product does. A clearer title can improve communication, but is not a guaranteed way to raise the score.",
    icon: MessageSquareText,
  },
};

function interpretFactor(reason, positive) {
  const guidance = FACTOR_GUIDANCE[factorKey(reason)];

  if (guidance) {
    return {
      ...guidance,
      title: positive
        ? guidance.strength
        : guidance.watchout,
    };
  }

  return {
    title: factorName(
      reason,
      positive
        ? "Another positive product signal"
        : "Another area worth reviewing"
    ),
    explanation:
      positive
        ? "This product characteristic contributed positively to the model's assessment."
        : "This product characteristic contributed negatively to the model's assessment.",
    consideration:
      "Consider this signal alongside customer needs, competitors, costs, and other business information rather than relying on it alone.",
    icon: CircleHelp,
  };
}

function sortFactors(items) {
  if (!Array.isArray(items)) return [];

  return [...items].sort((a, b) => {
    const aImpact = numberOrNull(a?.impact);
    const bImpact = numberOrNull(b?.impact);

    return Math.abs(bImpact ?? 0) - Math.abs(aImpact ?? 0);
  });
}

// ========================================
// SCORE HERO
// ========================================

function ScoreChips({ reasons }) {
  if (!reasons) return null;

  const positive = sortFactors(reasons.reasons_up).slice(0, 2);
  const negative = sortFactors(reasons.reasons_down).slice(0, 2);

  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {positive.map((reason, index) => (
        <span
          key={`positive-${index}`}
          className="rounded-full border border-[#B9E5D2] bg-[#EAF8F1] px-3 py-1.5 text-xs font-semibold text-[#13795B]"
        >
          + {factorName(reason, "Positive signal")}
        </span>
      ))}

      {negative.map((reason, index) => (
        <span
          key={`negative-${index}`}
          className="rounded-full border border-[#F2D7BD] bg-[#FFF3E8] px-3 py-1.5 text-xs font-semibold text-[#97531B]"
        >
          − {factorName(reason, "Potential concern")}
        </span>
      ))}
    </div>
  );
}

function OpportunityScoreHero({
  prediction,
  reasons,
  onExploreFactors,
}) {
  const score = numberOrNull(prediction?.opportunity_score);
  const hasScore = score !== null;
  const scoreBand = getScoreBand(score);

  return (
    <section className="mt-7 overflow-hidden rounded-2xl border border-[#D7E0EB] bg-white shadow-sm">
      <div className="grid lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="relative flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#193B66] to-[#275788] p-8 text-center text-white">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border-[38px] border-white/5"
          />

          <p className="relative z-10 text-xs font-bold uppercase tracking-[0.16em] text-[#FFD45A]">
            Opportunity intelligence
          </p>

          <div className="relative z-10 mt-5 rounded-full bg-white p-4 shadow-xl">
            <OpportunityGauge score={score} />
          </div>

          <p className="relative z-10 mt-6 text-sm font-semibold text-[#DCE8F5]">
            Product opportunity score
          </p>

          <p className="relative z-10 mt-2 text-xs text-[#C9D9EA]">
            Model-generated assessment
          </p>
        </div>

        <div className="flex flex-col justify-center p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-[#FFF6DD] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#8B6B1E]">
              Opportunity analysis
            </span>

            {hasScore && (
              <span
                className="rounded-full px-4 py-2 text-xs font-bold"
                style={{
                  color: scoreBand.color,
                  backgroundColor: `${scoreBand.color}14`,
                }}
              >
                {scoreBand.label}
              </span>
            )}
          </div>

          <h2 className="mt-5 text-2xl font-bold tracking-tight text-[#25334A] sm:text-3xl">
            Your product's opportunity
          </h2>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#61738B]">
            Understand your product's potential, discover
            the signals behind its assessment, and explore
            what may deserve more attention.
          </p>

          {hasScore && scoreBand.odds && (
            <div className="mt-5 rounded-xl border border-[#E2EAF3] bg-[#F6F9FD] p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[#193B66]">
                What your score means
              </p>

              <p className="mt-2 text-sm leading-6 text-[#61738B]">
                {scoreBand.odds}
              </p>
            </div>
          )}

          <ScoreChips reasons={reasons} />

          <div className="mt-6 flex flex-wrap gap-3">
            {hasScore && (
              <button
                type="button"
                onClick={onExploreFactors}
                className="inline-flex items-center gap-2 rounded-xl bg-[#FFD45A] px-6 py-3 text-sm font-bold text-[#25334A] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#F6C94D] motion-reduce:transition-none"
              >
                Explore product insights
                <ArrowRight size={17} />
              </button>
            )}

            {hasScore && (
              <Link
                to="/score-details"
                className="rounded-xl border border-[#D7E0EB] bg-white px-6 py-3 text-center text-sm font-semibold text-[#193B66] transition hover:bg-[#F5F8FC]"
              >
                Detailed explanations
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ========================================
// SCORE KPI CARDS
// ========================================

function ScoreSummaryCards({ prediction }) {
  const score = numberOrNull(prediction?.opportunity_score);
  const probability = numberOrNull(prediction?.probability);
  const band = getScoreBand(score);

  const probabilityValid =
    probability !== null &&
    probability >= 0 &&
    probability <= 1;

  const cards = [
    {
      label: "Opportunity score",
      value: score === null ? "—" : `${score}/100`,
      subtitle: "Overall product assessment",
      background: "linear-gradient(135deg,#193B66,#275788)",
      text: "text-white",
      muted: "text-[#DCE8F5]",
      badge: "SCORE",
    },
    {
      label: "Score classification",
      value: band.label,
      subtitle: "Product evaluation category",
      background: "linear-gradient(135deg,#F6C94D,#F9DD86)",
      text: "text-[#25334A]",
      muted: "text-[#705A31]",
      badge: "RATING",
    },
    {
      label: "Model probability",
      value: probabilityValid
        ? `${(probability * 100).toFixed(1)}%`
        : "—",
      subtitle: "Probability returned by the model",
      background: "linear-gradient(135deg,#11684F,#219674)",
      text: "text-white",
      muted: "text-[#D6F3E9]",
      badge: "MODEL OUTPUT",
    },
  ];

  return (
    <section className="mt-9">
      <SectionHeading
        eyebrow="Score performance"
        title="Evaluation overview"
        description="Key results from your product evaluation."
      />

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {cards.map((card, index) => (
          <motion.article
            key={card.label}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.1 }}
            whileHover={{ y: -5 }}
            className="relative flex min-h-[220px] min-w-0 flex-col justify-between overflow-hidden rounded-2xl p-6 shadow-md"
            style={{ background: card.background }}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full border-[30px] border-white/10"
            />

            <div className="relative z-10 flex items-start justify-between gap-3">
              <p className={`text-sm font-semibold ${card.muted}`}>
                {card.label}
              </p>
              <span className={`rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold ${card.text}`}>
                {card.badge}
              </span>
            </div>

            <div className="relative z-10 mt-8">
              <p className={`break-words text-[clamp(1.8rem,3vw,2.5rem)] font-bold tracking-tight ${card.text}`}>
                {card.value}
              </p>
              <p className={`mt-3 text-sm ${card.muted}`}>
                {card.subtitle}
              </p>
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  );
}

// ========================================
// FRIENDLY INSIGHT CARD
// ========================================

function FriendlyInsightCard({
  reason,
  positive,
  index,
}) {
  const [expanded, setExpanded] = useState(false);
  const interpretation = interpretFactor(reason, positive);
  const Icon = interpretation.icon;

  const impact = numberOrNull(reason?.impact);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="w-full max-w-[900px] overflow-hidden rounded-2xl border border-[#D7E0EB] bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-4 p-5 text-left sm:p-6"
      >
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
            positive
              ? "bg-[#E6F5ED] text-[#13795B]"
              : "bg-[#FFF2E8] text-[#B66A29]"
          }`}
        >
          <Icon size={22} aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-6 text-[#25334A] sm:text-base">
            {interpretation.title}
          </p>

          <p className="mt-1 text-xs text-[#61738B]">
            {positive
              ? "Positive product signal"
              : "Something worth reviewing"}
          </p>
        </div>

        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
            positive
              ? "bg-[#E6F5ED] text-[#13795B]"
              : "bg-[#FFF2E8] text-[#B66A29]"
          }`}
        >
          {expanded ? (
            <ChevronUp size={18} aria-hidden="true" />
          ) : (
            <ChevronDown size={18} aria-hidden="true" />
          )}
        </div>
      </button>

      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="border-t border-[#E8EEF4] px-5 pb-5 pt-5 sm:px-6 sm:pb-6"
        >
          <p className="text-sm leading-7 text-[#61738B]">
            {interpretation.explanation}
          </p>

          <div
            className={`mt-5 rounded-xl p-4 ${
              positive ? "bg-[#F0F8F4]" : "bg-[#FFF7EE]"
            }`}
          >
            <div className="flex items-center gap-2">
              <Lightbulb
                size={17}
                className={
                  positive
                    ? "text-[#13795B]"
                    : "text-[#B66A29]"
                }
              />
              <p className="text-sm font-bold text-[#25334A]">
                Worth considering
              </p>
            </div>

            <p className="mt-2 text-sm leading-6 text-[#61738B]">
              {interpretation.consideration}
            </p>
          </div>

          {impact !== null && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs text-[#61738B]">
                Model contribution:
              </span>

              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  positive
                    ? "bg-[#E6F5ED] text-[#13795B]"
                    : "bg-[#FFF2E8] text-[#97531B]"
                }`}
              >
                {impact > 0 ? "+" : ""}
                {impact.toFixed(3)}
              </span>

              <span className="text-xs text-[#61738B]">
                Not opportunity-score points
              </span>
            </div>
          )}
        </motion.div>
      )}
    </motion.article>
  );
}

// ========================================
// STRENGTHS / WATCHOUTS PANEL
// ========================================

function InsightCategoryPanel({
  category,
  reasons,
}) {
  const positive = category === "strengths";

  const items = sortFactors(
    positive
      ? reasons?.reasons_up
      : reasons?.reasons_down
  );

  const strongest = items[0]
    ? interpretFactor(items[0], positive)
    : null;

  return (
    <div
      className="flex h-full min-h-[450px] flex-col rounded-2xl border border-[#D7E0EB] p-5 sm:p-7"
      style={{
        backgroundColor: positive
          ? "#F0F8F4"
          : "#FFF7EE",
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
              positive
                ? "bg-[#DDF1E6] text-[#13795B]"
                : "bg-[#FCE9D6] text-[#B66A29]"
            }`}
          >
            {positive ? (
              <ThumbsUp size={23} />
            ) : (
              <Lightbulb size={23} />
            )}
          </div>

          <div>
            <h3 className="text-xl font-bold text-[#25334A]">
              {positive
                ? "What's working in your favor"
                : "Things worth reviewing"}
            </h3>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#61738B]">
              {positive
                ? "Explore the product characteristics that contributed positively to your assessment."
                : "Understand the characteristics that raised potential concerns in your assessment."}
            </p>
          </div>
        </div>

        <span
          className={`rounded-full px-4 py-2 text-xs font-bold ${
            positive
              ? "bg-[#DDF1E6] text-[#13795B]"
              : "bg-[#FCE9D6] text-[#97531B]"
          }`}
        >
          {items.length}{" "}
          {items.length === 1 ? "signal" : "signals"}
        </span>
      </div>

      {strongest && (
        <div className="mt-6 rounded-xl border border-white/80 bg-white/75 p-4">
          <p
            className={`text-xs font-bold uppercase tracking-wide ${
              positive
                ? "text-[#13795B]"
                : "text-[#97531B]"
            }`}
          >
            Most prominent {positive ? "strength" : "watchout"}
          </p>

          <p className="mt-2 text-sm font-semibold leading-6 text-[#25334A]">
            {strongest.title}
          </p>

          <p className="mt-1 text-xs leading-5 text-[#61738B]">
            Based on the largest absolute model contribution
            displayed in this group.
          </p>
        </div>
      )}

      <div className="my-auto flex flex-col items-center gap-4 py-6">
        {items.length > 0 ? (
          items.map((reason, index) => (
            <FriendlyInsightCard
              key={`${category}-${reason?.feature || index}-${index}`}
              reason={reason}
              positive={positive}
              index={index}
            />
          ))
        ) : (
          <div className="w-full max-w-[900px] rounded-xl bg-white p-6 text-sm text-[#61738B]">
            No {positive ? "positive signals" : "watchouts"}{" "}
            were provided for this product.
          </div>
        )}
      </div>

      <div className="flex items-start gap-2">
        <Info
          size={16}
          className="mt-0.5 shrink-0 text-[#61738B]"
        />
        <p className="text-xs leading-6 text-[#61738B]">
          These insights describe model associations.
          They are not guaranteed improvements or
          direct changes to the opportunity score.
        </p>
      </div>
    </div>
  );
}

// ========================================
// FULL-PANEL 3D INSIGHT TRANSITION
// ========================================

function StrengthsAndWatchouts({ reasons }) {
  const [category, setCategory] = useState("strengths");
  const [nextCategory, setNextCategory] = useState(null);
  const [flipped, setFlipped] = useState(false);

  const strengths = Array.isArray(reasons?.reasons_up)
    ? reasons.reasons_up.length
    : 0;

  const watchouts = Array.isArray(reasons?.reasons_down)
    ? reasons.reasons_down.length
    : 0;

  function selectCategory(newCategory) {
    if (
      newCategory === category ||
      nextCategory !== null
    ) {
      return;
    }

    if (
      window.matchMedia?.(
        "(prefers-reduced-motion: reduce)"
      ).matches
    ) {
      setCategory(newCategory);
      return;
    }

    setNextCategory(newCategory);
    setFlipped(true);
  }

  function finishFlip(event) {
    if (
      event.target !== event.currentTarget ||
      event.propertyName !== "transform" ||
      !flipped ||
      nextCategory === null
    ) {
      return;
    }

    setCategory(nextCategory);
    setNextCategory(null);
    setFlipped(false);
  }

  const selectedCategory = nextCategory ?? category;

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          disabled={nextCategory !== null}
          onClick={() => selectCategory("strengths")}
          aria-pressed={selectedCategory === "strengths"}
          className={`rounded-2xl border-2 p-5 text-left transition-all ${
            selectedCategory === "strengths"
              ? "border-[#13795B] bg-[#E6F5ED]"
              : "border-[#D7E0EB] bg-white hover:border-[#B7D6C6]"
          }`}
        >
          <div className="flex items-center gap-2">
            <ThumbsUp
              size={20}
              className={
                selectedCategory === "strengths"
                  ? "text-[#13795B]"
                  : "text-[#61738B]"
              }
            />

            <p className="font-bold text-[#25334A]">
              Strengths
            </p>
          </div>

          <p className="mt-3 text-3xl font-bold text-[#13795B]">
            {strengths}
          </p>

          <p className="mt-1 text-xs text-[#61738B]">
            Positive product signals
          </p>
        </button>

        <button
          type="button"
          disabled={nextCategory !== null}
          onClick={() => selectCategory("watchouts")}
          aria-pressed={selectedCategory === "watchouts"}
          className={`rounded-2xl border-2 p-5 text-left transition-all ${
            selectedCategory === "watchouts"
              ? "border-[#B66A29] bg-[#FFF2E8]"
              : "border-[#D7E0EB] bg-white hover:border-[#F0D7BE]"
          }`}
        >
          <div className="flex items-center gap-2">
            <Lightbulb
              size={20}
              className={
                selectedCategory === "watchouts"
                  ? "text-[#B66A29]"
                  : "text-[#61738B]"
              }
            />

            <p className="font-bold text-[#25334A]">
              Watchouts
            </p>
          </div>

          <p className="mt-3 text-3xl font-bold text-[#B66A29]">
            {watchouts}
          </p>

          <p className="mt-1 text-xs text-[#61738B]">
            Potential concerns
          </p>
        </button>
      </div>

      <div
        className="mt-6 w-full"
        style={{ perspective: "1600px" }}
      >
        <div
          className="grid w-full"
          onTransitionEnd={finishFlip}
          style={{
            transformStyle: "preserve-3d",
            transform: flipped
              ? "rotateY(180deg)"
              : "rotateY(0deg)",
            transition: flipped
              ? "transform 700ms cubic-bezier(0.22,1,0.36,1)"
              : "none",
          }}
        >
          <div
            className="min-w-0"
            style={{
              gridArea: "1 / 1",
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
            }}
            aria-hidden={flipped}
            inert={flipped}
          >
            <InsightCategoryPanel
              category={category}
              reasons={reasons}
            />
          </div>

          <div
            className="min-w-0"
            style={{
              gridArea: "1 / 1",
              transform: "rotateY(180deg)",
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
            }}
            aria-hidden={!flipped}
            inert={!flipped}
          >
            {nextCategory && (
              <InsightCategoryPanel
                category={nextCategory}
                reasons={reasons}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ========================================
// PRODUCT INFORMATION
// ========================================

function ProductInformation({ product, prediction }) {
  // Same signal as NewIdeaTag on the score details page: the launch-time
  // model scored the product and never saw the review count.
  const reviewsUnused =
    prediction?.model_used === "launch" &&
    Number(product.reviews) > 0;

  const details = [
    {
      label: "Category",
      value:
        product.categoryName ||
        product.category ||
        "—",
      symbol: "▦",
      color: "#193B66",
      background: "#EBF2FA",
    },
    {
      label: "Selling price",
      value: currency(product.price),
      symbol: "$",
      color: "#A77E1C",
      background: "#FFF6DD",
    },
    {
      label: "Customer reviews",
      value:
        product.reviews == null
          ? "—"
          : formatNumber(product.reviews),
      note: reviewsUnused
        ? "Not used in this score: scored as a new idea"
        : null,
      symbol: "★",
      color: "#13795B",
      background: "#EAF6F0",
    },
  ];

  return (
    <section className="mt-10">
      <SectionHeading
        eyebrow="Product intelligence"
        title="Product information"
        description="Details associated with the evaluated product."
      />

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {details.map((detail) => (
          <article
            key={detail.label}
            className="flex min-w-0 items-start gap-4 rounded-2xl border border-[#D7E0EB] bg-white p-5 shadow-sm"
          >
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl font-bold"
              style={{
                color: detail.color,
                backgroundColor: detail.background,
              }}
            >
              {detail.symbol}
            </div>

            <div className="min-w-0">
              <p className="text-xs text-[#61738B]">
                {detail.label}
              </p>

              <p className="mt-2 break-words text-lg font-bold text-[#25334A]">
                {detail.value}
              </p>

              {detail.note && (
                <p className="mt-1 text-xs text-[#61738B]">
                  {detail.note}
                </p>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

// ========================================
// PRICE SCENARIO PREVIEW
// ========================================

function PriceScenarioPreview({ product }) {
  const originalPrice = Number(product.price);

  const [selectedPrice, setSelectedPrice] =
    useState(() => String(product.price));

  const minPrice = Math.max(
    0.01,
    Number(
      Math.min(100000, originalPrice * 0.5).toFixed(2)
    )
  );

  const maxPrice = Math.min(
    100000,
    Number(
      Math.max(originalPrice * 1.5, minPrice).toFixed(2)
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
    <section className="mt-10 overflow-hidden rounded-2xl border border-[#D7E0EB] bg-white p-6 shadow-sm sm:p-7">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.13em] text-[#A77E1C]">
            Pricing strategy
          </p>

          <h2 className="text-xl font-bold text-[#25334A] sm:text-2xl">
            Explore price scenarios
          </h2>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#61738B]">
            Preview a different selling price, then
            explore how your assumptions affect
            profitability and product evaluation.
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
          className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold transition ${
            validPrice
              ? "bg-[#FFD45A] text-[#25334A] hover:bg-[#F5C842]"
              : "pointer-events-none bg-slate-200 text-slate-400"
          }`}
        >
          Explore Price Scenarios
          <ArrowRight size={18} />
        </Link>
      </div>

      <div className="mt-7 grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl bg-[#F5F8FC] p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs text-[#61738B]">
                Original price
              </p>

              <p className="mt-2 text-2xl font-bold text-[#25334A]">
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
                <span className="font-bold text-[#25334A]">
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
                    setSelectedPrice(event.target.value)
                  }
                  className="h-12 w-36 rounded-xl border border-[#D7E0EB] bg-white px-4 text-base font-bold text-[#25334A] outline-none focus:border-[#193B66]"
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
                    Math.min(maxPrice, numericPrice)
                  )
                : originalPrice
            }
            onChange={(event) =>
              setSelectedPrice(event.target.value)
            }
            disabled={minPrice >= maxPrice}
            aria-label="Preview selling price"
            className="mt-8 w-full cursor-pointer accent-[#193B66]"
          />

          <div className="mt-3 flex justify-between text-xs text-[#61738B]">
            <span>{currency(minPrice)}</span>
            <span>{currency(maxPrice)}</span>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#193B66] to-[#275788] p-5 text-white sm:p-6">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full border-[30px] border-white/5"
          />

          <p className="relative z-10 text-sm text-[#DCE8F5]">
            Price adjustment
          </p>

          <p className="relative z-10 mt-5 text-4xl font-bold">
            {priceChange === null
              ? "—"
              : `${priceChange > 0 ? "+" : ""}${priceChange.toFixed(1)}%`}
          </p>

          <p className="relative z-10 mt-3 text-sm text-[#DCE8F5]">
            {validPrice
              ? `Scenario price: ${currency(numericPrice)}`
              : "Enter a valid scenario price."}
          </p>

          <button
            type="button"
            onClick={() =>
              setSelectedPrice(String(originalPrice))
            }
            className="relative z-10 mt-6 rounded-lg border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
          >
            Reset price
          </button>
        </div>
      </div>

      <p className="mt-5 text-xs leading-5 text-[#61738B]">
        This preview does not recalculate your score or
        forecast sales. Your chosen price is carried
        into the scenario simulator.
      </p>
    </section>
  );
}

// ========================================
// LEGACY LAUNCH METRICS
// ========================================

function MetricCard({ label, metric }) {
  const range = validRange(metric);

  return (
    <article className="min-h-[150px] rounded-2xl border border-[#D7E0EB] bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-[#61738B]">
        {label}
      </p>

      <p className="mt-4 break-words text-3xl font-bold text-[#25334A]">
        {formatMetric(metric)}
      </p>

      {range ? (
        <p className="mt-3 text-xs leading-5 text-[#61738B]">
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
      ) : metric?.range ? (
        <p className="mt-3 text-xs text-[#61738B]">
          Estimated range unavailable.
        </p>
      ) : null}
    </article>
  );
}

// ========================================
// FLOATING SCORE INFORMATION
// ========================================

function AboutScore({ prediction }) {
  const [open, setOpen] = useState(false);
  const score = numberOrNull(prediction?.opportunity_score);
  const band = getScoreBand(score);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="About this opportunity score"
        title="About this opportunity score"
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#193B66] text-white shadow-xl ring-4 ring-white/70 transition hover:-translate-y-1 hover:bg-[#275788]"
      >
        <Info size={25} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
            }
          }}
        >
          <button
            type="button"
            aria-label="Close score information"
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-[#0F172A]/40 backdrop-blur-[2px]"
          />

          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-score-title"
            className="absolute bottom-6 right-4 flex max-h-[85vh] w-[calc(100%-2rem)] max-w-[440px] flex-col overflow-hidden rounded-2xl border border-[#D7E0EB] bg-white shadow-2xl sm:right-6"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#E6EDF4] bg-[#F8FAFD] p-5">
              <div>
                <h2
                  id="about-score-title"
                  className="text-lg font-bold text-[#25334A]"
                >
                  About this score
                </h2>

                <p className="mt-1 text-xs text-[#61738B]">
                  How to understand your evaluation
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-lg p-2 text-[#61738B] hover:bg-[#E6EDF4]"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto p-5">
              <p className="text-sm leading-7 text-[#61738B]">
                Your opportunity score is generated by
                MarketLens's product scoring model.
                It is an estimate, not a guarantee
                of commercial success.
              </p>

              {score !== null && (
                <div className="mt-5 rounded-xl bg-[#F5F8FC] p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#61738B]">
                    Current score category
                  </p>

                  <p
                    className="mt-2 text-lg font-bold"
                    style={{ color: band.color }}
                  >
                    {band.label}
                  </p>

                  {band.odds && (
                    <p className="mt-3 text-sm leading-6 text-[#61738B]">
                      {band.odds}
                    </p>
                  )}
                </div>
              )}

              <p className="mt-5 text-sm leading-7 text-[#61738B]">
                Strengths and watchouts describe
                model associations. They are not
                guaranteed ways to improve your score.
                Actual product performance depends on
                many factors beyond the model.
              </p>
            </div>

            <div className="border-t border-[#E6EDF4] p-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full rounded-xl bg-[#193B66] px-5 py-3 text-sm font-semibold text-white hover:bg-[#275788]"
              >
                Got it
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

// ========================================
// MAIN OPPORTUNITY ANALYSIS
// ========================================

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

  const score = numberOrNull(prediction?.opportunity_score);
  const hasScore = score !== null;

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

  // ========================================
  // LOAD MODEL REASONS
  // ========================================

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
          // Do not display technical request errors
          // or backend route names to customers.
          setReasonsError(
            "We couldn't load your product insights. Please try again."
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
    setRetryCount((value) => value + 1);
  }

  function exploreFactors() {
    setShowExplanations(true);

    requestAnimationFrame(() => {
      document
        .getElementById("opportunity-product-insights")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    });
  }

  const isTwelveMonths = launchTimeframe === "12m";

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

  // ========================================
  // EMPTY STATE
  // ========================================

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
          className="mt-6 inline-block rounded-xl bg-[#FFD45A] px-6 py-3 font-semibold text-[#25334A]"
        >
          Discover products
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1440px] px-5 py-8 text-[#0F172A] sm:px-8 lg:px-16 xl:px-24">
      {/* BREADCRUMB */}

      <div className="text-xs text-[#61738B]">
        Discover
        <span className="mx-3">›</span>
        Product overview
      </div>

      {/* HEADER */}

      <div className="mt-6 flex flex-col justify-between gap-5 md:flex-row md:items-start">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.13em] text-[#A77E1C]">
            MarketLens / Product Intelligence
          </p>

          <h1 className="text-3xl font-bold tracking-tight text-[#25334A] sm:text-4xl">
            Opportunity analysis
          </h1>

          <p className="mt-3 text-sm leading-6 text-[#61738B] sm:text-base">
            Explore your product's potential, strengths,
            watchouts, and pricing opportunities.
          </p>
        </div>

        <Link
          to="/discover"
          className="shrink-0 rounded-xl border border-[#D4A529] bg-white px-5 py-3 text-center text-sm font-semibold text-[#25334A] hover:bg-[#FFFAEC]"
        >
          Explore another product
        </Link>
      </div>

      {/* PRODUCT */}

      <section className="mt-7 rounded-2xl border border-[#D7E0EB] bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-[#A77E1C]">
          Evaluated product
        </p>

        <h2 className="mt-2 break-words text-lg font-bold text-[#25334A] sm:text-xl">
          {productName}
        </h2>
      </section>

      {/* SCORE HERO */}

      <OpportunityScoreHero
        prediction={prediction}
        reasons={reasons}
        onExploreFactors={exploreFactors}
      />

      {/* KPI CARDS */}

      {hasScore && (
        <ScoreSummaryCards prediction={prediction} />
      )}

      {/* STRENGTHS & WATCHOUTS */}

      {hasScore && (
        <section
          id="opportunity-product-insights"
          className="mt-10 scroll-mt-8"
        >
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <SectionHeading
              eyebrow="Your product insights"
              title="What stands out about your product?"
              description="Understand what's working in your favor and what may deserve a closer look."
            />

            <button
              type="button"
              onClick={() =>
                setShowExplanations(
                  (value) => !value
                )
              }
              aria-expanded={showExplanations}
              aria-controls="strengths-watchouts-content"
              className="inline-flex w-fit items-center gap-2 rounded-xl border border-[#D7E0EB] bg-white px-5 py-3 text-sm font-semibold text-[#193B66] shadow-sm hover:bg-[#F5F8FC]"
            >
              {showExplanations
                ? "Hide insights"
                : "Explore insights"}

              {showExplanations ? (
                <ChevronUp size={18} />
              ) : (
                <ChevronDown size={18} />
              )}
            </button>
          </div>

          {showExplanations && (
            <div
              id="strengths-watchouts-content"
              className="mt-6"
            >
              {loadingReasons && (
                <p
                  role="status"
                  className="rounded-2xl border border-[#D7E0EB] bg-white p-6 text-sm text-[#61738B]"
                >
                  Preparing your product insights...
                </p>
              )}

              {reasonsError && !loadingReasons && (
                <div
                  role="alert"
                  className="rounded-2xl border border-amber-200 bg-[#FFF7EE] p-6"
                >
                  <p className="text-sm text-[#97531B]">
                    {reasonsError}
                  </p>

                  <button
                    type="button"
                    onClick={retryExplanations}
                    className="mt-3 text-sm font-bold text-[#97531B] underline"
                  >
                    Try again
                  </button>
                </div>
              )}

              {reasons && !loadingReasons && (
                <StrengthsAndWatchouts
                  key={productName}
                  reasons={reasons}
                />
              )}

              <div className="mt-5 flex justify-end">
                <Link
                  to="/score-details"
                  className="inline-flex items-center gap-2 rounded-xl border border-[#D7E0EB] bg-white px-5 py-3 text-sm font-semibold text-[#193B66] hover:bg-[#F5F8FC]"
                >
                  View detailed explanations
                  <ArrowRight size={17} />
                </Link>
              </div>
            </div>
          )}
        </section>
      )}

      {/* PRODUCT INFORMATION */}

      {product && (
        <ProductInformation
          product={product}
          prediction={prediction}
        />
      )}

      {/* PRICE SCENARIOS */}

      {hasScore &&
        product &&
        numberOrNull(product.price) !== null &&
        Number(product.price) > 0 && (
          <PriceScenarioPreview
            key={JSON.stringify(product)}
            product={product}
          />
        )}

      {/* EXISTING LEGACY LAUNCH RESULTS */}

      {predictions && (
        <section className="mt-10">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <SectionHeading
              eyebrow="Previously generated estimates"
              title="Product launch estimates"
              description="Compare saved launch estimates over 12 or 24 months."
            />

            <div
              role="group"
              aria-label="Launch forecast timeframe"
              className="inline-flex w-fit gap-1 rounded-xl border border-[#D7E0EB] bg-white p-1 shadow-sm"
            >
              <button
                type="button"
                onClick={() => setLaunchTimeframe("12m")}
                aria-pressed={isTwelveMonths}
                className={`rounded-lg px-5 py-3 text-sm font-semibold ${
                  isTwelveMonths
                    ? "bg-[#FFD45A] text-[#25334A]"
                    : "text-[#61738B] hover:bg-[#F5F8FC]"
                }`}
              >
                12 Months
              </button>

              <button
                type="button"
                onClick={() => setLaunchTimeframe("24m")}
                aria-pressed={!isTwelveMonths}
                className={`rounded-lg px-5 py-3 text-sm font-semibold ${
                  !isTwelveMonths
                    ? "bg-[#FFD45A] text-[#25334A]"
                    : "text-[#61738B] hover:bg-[#F5F8FC]"
                }`}
              >
                24 Months
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {launchMetrics.map(({ label, metric }) => (
              <MetricCard
                key={label}
                label={label}
                metric={metric}
              />
            ))}
          </div>
        </section>
      )}

      {/* FLOATING HELP */}

      <AboutScore prediction={prediction} />
    </main>
  );
}
