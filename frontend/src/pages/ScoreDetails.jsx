
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getPredictionReasons } from "../services/marketlensApi";

export default function ScoreDetails({ product, prediction }) {
  const navigate = useNavigate();

  const [reasons, setReasons] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!prediction || !product?.title) return;

    let active = true;

    async function loadReasons() {
      setLoading(true);
      setError("");

      try {
        const data = await getPredictionReasons(product);

        if (active) {
          setReasons(data);
        }
      } catch (err) {
        if (active) {
          setError(err.message || "Failed to load explanations.");
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
  }, [product, prediction]);

  if (!prediction) {
    return (
      <main className="mx-auto max-w-[1248px] px-6 py-12 lg:px-0">
        <h1 className="text-3xl font-bold">
          Score explanations
        </h1>

        <p className="mt-4 text-slate-600">
          Score a product first to view its explanations.
        </p>

        <button
          onClick={() => navigate("/discover")}
          className="mt-6 rounded-lg bg-[#FFD45A] px-6 py-3 font-semibold"
        >
          Go to Discover
        </button>
      </main>
    );
  }

  const renderReasons = (items, positive) => (
    <div className="space-y-3">
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">
          No factors returned.
        </p>
      ) : (
        items.map((reason, index) => (
          <div
            key={`${reason.feature}-${index}`}
            className="rounded-lg border border-[#D5DADF] bg-white p-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-[#0F172A]">
                  {reason.label}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {reason.feature}
                </p>
              </div>

              <span
                className={`text-sm font-semibold ${
                  positive ? "text-green-700" : "text-red-700"
                }`}
              >
                {reason.impact > 0 ? "+" : ""}
                {reason.impact.toFixed(3)}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  );

  return (
    <main className="mx-auto max-w-[1440px] px-6 py-7 lg:px-24">
      <p className="text-xs text-slate-500">
        Overview › Score explanations
      </p>

      <div className="my-7">
        <h1 className="text-3xl font-bold">
          Why did this product receive this score?
        </h1>

        <p className="mt-3 text-slate-600">
          Explore the factors influencing your product's
          opportunity score.
        </p>
      </div>

      <section className="mb-6 rounded-lg border border-[#D5DADF] bg-white p-6">
        <p className="text-sm text-slate-500">
          {product.title}
        </p>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-5xl font-bold">
            {prediction.opportunity_score}
          </span>
          <span className="text-slate-500">/100</span>
        </div>

        <p className="mt-2 text-sm text-slate-600">
          Product Opportunity Score
        </p>
      </section>

      {loading && (
        <p role="status" className="text-sm text-slate-600">
          Analyzing model explanations...
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {reasons && (
        <div className="grid gap-6 md:grid-cols-2">
          <section>
            <h2 className="mb-4 text-xl font-semibold">
              Positive factors
            </h2>

            {renderReasons(reasons.reasons_up, true)}
          </section>

          <section>
            <h2 className="mb-4 text-xl font-semibold">
              Negative factors
            </h2>

            {renderReasons(reasons.reasons_down, false)}
          </section>
        </div>
      )}

      <button
        onClick={() => navigate("/overview")}
        className="mt-8 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold hover:bg-slate-50"
      >
        ← Back to Overview
      </button>
    </main>
  );
}
