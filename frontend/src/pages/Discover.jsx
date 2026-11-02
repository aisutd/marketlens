
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import ProductForm from "../components/ProductForm";
import EvaluationSummary from "../components/EvaluationSummary";
import { predictProduct } from "../services/marketlensApi";

export default function Discover({
  product,
  setProduct,
  prediction,
  setPrediction,
  setScoredProduct,
}) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const updateProduct = (updater) => {
    setProduct(updater);
    setError("");
  };

  const handleScoreProduct = async () => {
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const submittedProduct = { ...product };
      const result = await predictProduct(submittedProduct);

      setScoredProduct(submittedProduct);
      setPrediction(result);
      navigate("/overview");
    } catch (err) {
      setError(err.message || "Unable to score product.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-[1440px] px-6 py-7 lg:px-24">
      <div className="text-xs text-slate-500">
        Discover ›{" "}
        <span className="text-slate-900">
          Product evaluation
        </span>
      </div>

      <div className="my-7">
        <h1 className="text-3xl font-bold">
          Evaluate a product idea
        </h1>

        <p className="mt-3 text-slate-600">
          Enter a product title, category and price.
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <ProductForm
          product={product}
          setProduct={updateProduct}
        />

        <EvaluationSummary
          product={product}
          prediction={null}
          loading={loading}
          onSubmit={handleScoreProduct}
        />
      </div>

      {error && (
        <div
          role="alert"
          className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}
    </main>
  );
}
