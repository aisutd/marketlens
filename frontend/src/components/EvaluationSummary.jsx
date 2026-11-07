
import { getScoreBand } from "../constants/scoreBands";

export default function EvaluationSummary({
  product,
  prediction,
  loading,
  onSubmit,
}) {
  const requirements = [
    ["Product title", product.title.trim() !== ""],
    ["Category", product.category.trim() !== ""],
    [
      "Selling price",
      product.price !== "" &&
        Number.isFinite(Number(product.price)) &&
        Number(product.price) > 0 &&
        Number(product.price) <= 100000,
    ],
  ];

  const originalPriceValid =
    product.originalPrice === "" ||
    (Number.isFinite(Number(product.originalPrice)) &&
      Number(product.originalPrice) >= 0);

  const ready =
    requirements.every(([, completed]) => completed) &&
    originalPriceValid;

  const score = prediction?.opportunity_score;

  const hasPrediction =
    typeof score === "number" &&
    Number.isFinite(score);

  const normalizedScore = hasPrediction
    ? Math.max(0, Math.min(100, score))
    : 0;

  const { label: scoreLabel, color: scoreColor } =
    getScoreBand(score);

  return (
    <aside className="space-y-5">
      <section className="overflow-hidden rounded-lg border border-[#D5DADF] bg-white">
        <div className="space-y-4 p-6">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-500">
              SINGLE PRODUCT
            </span>

            <span className="rounded bg-slate-100 px-2 py-1 text-slate-600">
              {hasPrediction ? "Scored" : "Not scored"}
            </span>
          </div>

          <h2 className="text-xl font-semibold">
            Your product evaluation
          </h2>

          {hasPrediction ? (
            <div
              aria-live="polite"
              className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-center"
            >
              <p className="text-sm font-medium text-slate-600">
                Product Opportunity Score
              </p>

              <p
                className="mt-3 text-5xl font-bold"
                style={{ color: scoreColor }}
              >
                {score}
                <span className="text-lg text-slate-400">
                  /100
                </span>
              </p>

              <p
                className="mt-2 text-sm font-semibold"
                style={{ color: scoreColor }}
              >
                {scoreLabel}
              </p>

              <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${normalizedScore}%`,
                    backgroundColor: scoreColor,
                  }}
                />
              </div>

              <div className="mt-5 space-y-2 text-left text-xs text-slate-600">
                <p>
                  <strong>Probability:</strong>{" "}
                  {typeof prediction.probability === "number"
                    ? `${(prediction.probability * 100).toFixed(1)}%`
                    : "N/A"}
                </p>

                <p>
                  <strong>Model:</strong>{" "}
                  {prediction.model_used ?? "N/A"}
                </p>

                <p>
                  <strong>Version:</strong>{" "}
                  {prediction.model_version ?? "N/A"}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm leading-6 text-slate-600">
              Start with the essentials. Your score will
              appear after you submit your product.
            </p>
          )}

          <div className="space-y-4 pt-2">
            {requirements.map(([label, completed]) => (
              <div
                key={label}
                className="flex items-center gap-3 text-sm"
              >
                <span
                  className={
                    completed
                      ? "text-green-600"
                      : "text-slate-400"
                  }
                >
                  {completed ? "✓" : "○"}
                </span>

                <span className="flex-1">
                  {label}
                </span>

                <span className="text-xs text-slate-500">
                  {completed ? "Entered" : "Not entered"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-200 bg-slate-50 p-6">
          <button
            type="button"
            disabled={!ready || loading}
            onClick={onSubmit}
            className="w-full rounded-lg border border-[#E9BC3E] bg-[#FFD45A] px-4 py-3 text-sm font-semibold transition hover:bg-[#F5C842] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Analyzing product..."
              : hasPrediction
              ? "Score again →"
              : "Score product →"}
          </button>

          <p className="mt-3 text-center text-xs text-slate-500">
            {!ready
              ? "Complete the required fields with valid prices."
              : hasPrediction
              ? "Prediction received from MarketLens API."
              : "Ready for product evaluation."}
          </p>
        </div>
      </section>

      <div className="px-1">
        <h3 className="text-sm font-semibold">
          What happens next?
        </h3>

        <p className="mt-2 text-xs leading-5 text-slate-600">
          Review product score, then explore Overview
          and Launch feasibility.
        </p>
      </div>
    </aside>
  );
}
