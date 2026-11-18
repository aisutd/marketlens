
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import ApiErrorNotice from "../components/ApiErrorNotice";
import ProductSearch from "../components/ProductSearch";

import {
  getCategories,
  predictProduct,
} from "../services/marketlensApi";

import {
  predictLaunch,
  predictMonthly,
  predictYearly,
} from "../services/forecastingApi";

export default function Discover({
  setProduct,
  setPrediction,
  setScoredProduct,
  setForecast,
}) {
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [categoriesError, setCategoriesError] = useState(null);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesAttempt, setCategoriesAttempt] = useState(0);

  // Load categories used by Opportunity Analysis.
  useEffect(() => {
    let active = true;

    async function loadCategories() {
      setCategoriesLoading(true);
      setCategoriesError(null);

      try {
        const result = await getCategories();

        if (active) {
          setCategories(
            Array.isArray(result) ? result : []
          );
        }
      } catch (err) {
        if (active) {
          setCategoriesError(err);
        }
      } finally {
        if (active) {
          setCategoriesLoading(false);
        }
      }
    }

    loadCategories();

    return () => {
      active = false;
    };
  }, [categoriesAttempt]);

  async function handleAnalyze(search) {
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      // ----------------------------------------
      // PRODUCT OPPORTUNITY ANALYSIS
      // ----------------------------------------

      if (search.method === "details") {
        const product = search.scoringProduct;

        if (!product) {
          throw new Error(
            "Valid product details are required."
          );
        }

        const score = await predictProduct(product);

        if (!score) {
          throw new Error(
            "No opportunity score was returned."
          );
        }

        setProduct(product);
        setScoredProduct(product);
        setPrediction(score);
        setForecast(null);

        navigate("/product-overview");
      }

      // ----------------------------------------
      // EXISTING PRODUCT FORECASTING
      // ----------------------------------------

      else if (search.method === "id") {
        const productId = String(
          search.productId ?? ""
        ).trim();

        if (!productId) {
          throw new Error(
            "Enter a valid Product ID."
          );
        }

        const [monthlyResult, yearlyResult] =
          await Promise.allSettled([
            predictMonthly(productId),
            predictYearly(productId),
          ]);

        const monthly =
          monthlyResult.status === "fulfilled"
            ? monthlyResult.value
            : null;

        const yearly =
          yearlyResult.status === "fulfilled"
            ? yearlyResult.value
            : null;

        // Both failed: pass on the real reason (not found, offline,
        // timed out) rather than a generic one.
        if (monthly === null && yearly === null) {
          const failure =
            monthlyResult.status === "rejected"
              ? monthlyResult.reason
              : yearlyResult.status === "rejected"
                ? yearlyResult.reason
                : null;

          throw failure ||
            new Error(
              "No forecasts were returned for this Product ID."
            );
        }

        setProduct(null);
        setScoredProduct(null);
        setPrediction(null);

        setForecast({
          type: "existing",
          productId,
          launch: null,
          monthly,
          yearly,
          notCovered: false,
        });

        navigate("/sales-forecast-overview");
      }

      // ----------------------------------------
      // NEW PRODUCT LAUNCH FORECASTING
      // ----------------------------------------

      else if (search.method === "launch") {
        const product = search.forecastingProduct;

        if (!product) {
          throw new Error(
            "Valid launch product details are required."
          );
        }

        const result = await predictLaunch(product);

        if (!result || !result.predictions) {
          throw new Error(
            "No launch forecast was returned."
          );
        }

        // Clear previous analysis results.
        setProduct(null);
        setScoredProduct(null);
        setPrediction(null);

        // Store the launch prediction separately
        // from existing-product forecasts.
        setForecast({
          type: "launch",
          productId: null,
          product,
          launch: result,
          monthly: null,
          yearly: null,
          notCovered: false,
        });

        navigate("/sales-forecast-overview");
      }

      else {
        throw new Error(
          "Unknown analysis method."
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err
          : new Error("Unable to analyze this product.")
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-5 pb-24 pt-12 sm:px-8 lg:pt-16">
        <header className="mb-12 border-b border-ink pb-10">
          <p className="eyebrow flex items-center gap-3 text-muted-foreground">
            <span className="text-primary">01</span>
            <span className="h-px w-8 bg-current" />
            Product Discovery
          </p>

          <h1 className="mt-6 max-w-3xl font-display text-5xl leading-[1.02] sm:text-6xl">
            Discover your next{" "}
            <em className="text-primary">
              opportunity.
            </em>
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Evaluate a product idea, explore sales
            forecasts, and make more informed
            decisions with MarketLens.
          </p>
        </header>

        <ApiErrorNotice
          title="Categories unavailable"
          error={categoriesError}
          onRetry={() =>
            setCategoriesAttempt((previous) => previous + 1)
          }
          retrying={categoriesLoading}
          className="mb-6"
        />

        <ProductSearch
          categories={categories}
          loading={loading}
          onAnalyze={handleAnalyze}
          submitError={error}
        />
      </div>
    </main>
  );
}
