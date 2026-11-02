
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

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

/**
 * Discover page.
 *
 * Supports two search methods:
 * 1. Product Details: scoring + launch forecasting.
 * 2. Product ID: monthly + yearly forecasting.
 *
 * Both methods share one Analyze Product button.
 */
export default function Discover({
  setProduct,
  setPrediction,
  setScoredProduct,
  setForecast,
}) {
  const navigate = useNavigate();

  // Categories used by the Product Details dropdown.
  const [categories, setCategories] = useState([]);

  // Request and error states for the Discover page.
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [categoriesError, setCategoriesError] = useState("");

  // Load available product categories from the scoring backend.
  useEffect(() => {
    let active = true;

    async function loadCategories() {
      try {
        const result = await getCategories();

        if (active) {
          setCategories(
            Array.isArray(result) ? result : []
          );
        }
      } catch (err) {
        if (active) {
          setCategoriesError(
            err.message || "Unable to load categories."
          );
        }
      }
    }

    loadCategories();

    return () => {
      active = false;
    };
  }, []);

  /**
   * Processes a search submitted by ProductSearch.
   *
   * Promise.allSettled allows one backend to succeed
   * even when the other backend fails.
   */
  async function handleAnalyze(search) {
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      if (search.method === "details") {
        // Both APIs independently evaluate the same input product.
        const [scoringResult, launchResult] =
          await Promise.allSettled([
            predictProduct(search.scoringProduct),
            predictLaunch(search.forecastingProduct),
          ]);

        const score =
          scoringResult.status === "fulfilled"
            ? scoringResult.value
            : null;

        const launch =
          launchResult.status === "fulfilled"
            ? launchResult.value
            : null;

        // At least one backend must return successfully.
        if (score === null && launch === null) {
          throw new Error(
            "Product scoring and launch forecasting both failed."
          );
        }

        // Save the product and scoring result for other pages.
        setProduct(search.scoringProduct);
        setScoredProduct(search.scoringProduct);
        setPrediction(score);

        // Store launch forecasting separately from scoring.
        setForecast({
          type: "launch",
          productId: null,
          launch,
          monthly: null,
          yearly: null,
        });
      } else if (search.method === "id") {
        // Product ID is supported by the forecasting backend.
        const [monthlyResult, yearlyResult] =
          await Promise.allSettled([
            predictMonthly(search.productId),
            predictYearly(search.productId),
          ]);

        const monthly =
          monthlyResult.status === "fulfilled"
            ? monthlyResult.value
            : null;

        const yearly =
          yearlyResult.status === "fulfilled"
            ? yearlyResult.value
            : null;

        if (monthly === null && yearly === null) {
          throw new Error(
            "No forecasts were returned for this Product ID."
          );
        }

        // Clear old scoring results to avoid showing
        // a score belonging to a previously searched product.
        setProduct(null);
        setScoredProduct(null);
        setPrediction(null);

        // Save monthly and yearly forecasts.
        setForecast({
          type: "existing",
          productId: search.productId,
          launch: null,
          monthly,
          yearly,
        });
      } else {
        throw new Error("Unknown search method.");
      }

      // Display whichever results were successfully retrieved.
      navigate("/overview");
    } catch (err) {
      setError(
        err.message || "Unable to analyze this product."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-[1440px] px-6 py-10 lg:px-24">
      {/* Page heading */}
      <div className="mb-8">
        <p className="mb-3 text-xs font-medium text-[#61738B]">
          Discover / Product search
        </p>

        <h1 className="text-[32px] font-bold text-[#25334A]">
          Discover products
        </h1>

        <p className="mt-2 text-base text-[#61738B]">
          Search by product details or an existing Product ID.
        </p>
      </div>

      {/* Category loading failures */}
      {categoriesError && (
        <p
          role="alert"
          className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
        >
          {categoriesError}
        </p>
      )}

      {/* Product analysis failures */}
      {error && (
        <p
          role="alert"
          className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {/* Unified search interface */}
      <ProductSearch
        categories={categories}
        loading={loading}
        onAnalyze={handleAnalyze}
      />
    </main>
  );
}
